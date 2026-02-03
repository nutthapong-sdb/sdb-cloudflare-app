import { NextResponse } from 'next/server';
import axios from 'axios';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

export async function POST(request) {
    try {
        const body = await request.json();
        const { action, zoneId, accountId, apiToken } = body;

        // Require token from body
        const token = apiToken;

        if (!token) {
            return NextResponse.json({ success: false, message: 'Missing Cloudflare API Token' }, { status: 401 });
        }

        // console.log(`🔔 API Action: ${action}`);

        // 1. Test Connection
        if (action === 'test') {
            return NextResponse.json({ success: true, message: 'API is working' });
        }

        // 2. List Zones (Domains)
        else if (action === 'list-zones') {
            let url = `${CLOUDFLARE_API_BASE}/zones?per_page=50`;
            if (accountId) {
                url += `&account.id=${accountId}`;
            }

            // console.log(`📋 Listing Zones for Account: ${accountId || 'All'}...`);
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            let zones = response.data.result || [];

            const simplifiedZones = zones.map(z => ({
                id: z.id,
                name: z.name,
                status: z.status,
                account: z.account
            }));

            return NextResponse.json({ success: true, data: simplifiedZones });

        }

        // 3. Get DNS Records (Subdomains) - With Pagination
        else if (action === 'get-dns-records') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            let allRecords = [];
            let page = 1;
            const perPage = 100; // Cloudflare max is usually 100
            let hasMore = true;

            console.log(`📝 Fetching ALL DNS Records for Zone: ${zoneId}...`);

            try {
                while (hasMore) {
                    process.stdout.write(`   Fetching page ${page}... `); // Show progress in backend logs
                    const response = await axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        params: {
                            per_page: perPage,
                            page: page
                        }
                    });

                    const records = response.data.result;
                    if (records && records.length > 0) {
                        allRecords = allRecords.concat(records);
                        console.log(`Found ${records.length} records.`);
                        if (records.length < perPage) {
                            hasMore = false; // Last page
                        } else {
                            page++;
                        }
                    } else {
                        console.log('No more records.');
                        hasMore = false;
                    }
                }
            } catch (error) {
                console.error('Error fetching DNS page:', error.message);
                // Return what we have so far, or error
                if (allRecords.length === 0) return NextResponse.json({ success: false, message: 'Failed to fetch DNS records' }, { status: 500 });
            }

            // --- Fetch Load Balancers (Inject as Type: LB) ---
            process.stdout.write(`   Fetching Load Balancers... `);
            let lbRecords = [];
            try {
                const lbResponse = await axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/load_balancers`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                });

                if (lbResponse.data.result) {
                    lbRecords = lbResponse.data.result.map(lb => ({
                        id: lb.id,
                        name: lb.name,
                        type: "LB", // Custom Type
                        content: lb.description || "Load Balancer Activity",
                        ttl: 1, // Dynamic
                        proxied: true, // LBs are always proxied
                        proxiable: true,
                        settings: {},
                        meta: {},
                        created_on: lb.created_on,
                        modified_on: lb.modified_on
                    }));
                    console.log(`Found ${lbRecords.length} Load Balancers.`);
                }
            } catch (lbError) {
                console.warn('   ⚠️ Failed to fetch Load Balancers (might be restricted/irrelevant):', lbError.message);
            }

            // Combine: LBs on TOP
            allRecords = [...lbRecords, ...allRecords];

            // Filter: Only PROXIED records
            const totalBefore = allRecords.length;
            allRecords = allRecords.filter(r => r.proxied === true);
            console.log(`   📉 Filtered DNS Only records: ${totalBefore} -> ${allRecords.length} (Proxied Only)`);

            console.log(`\n🔍 [DEBUG] RAW DNS RECORDS for Zone ${zoneId}:`);
            console.log(`Total Fetched: ${allRecords.length} (incl. ${lbRecords.length} LBs)`);
            // console.log(JSON.stringify(allRecords, null, 2)); // Too big to log all
            console.log('---------------------------------------------------\n');

            return NextResponse.json({ success: true, data: allRecords });
        }

        // 4. Get Account Info
        else if (action === 'get-account-info') {
            // console.log(`👤 Fetching Account Info...`);
            const response = await axios.get(`${CLOUDFLARE_API_BASE}/accounts`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            return NextResponse.json({ success: true, data: response.data.result });
        }

        // 6. Get Traffic Analytics (GraphQL) - MAIN DASHBOARD
        else if (action === 'get-traffic-analytics') {
            console.log('🔹 API: Traffic Request Received for Zone:', zoneId);
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            // console.log(`📊 Fetching GraphQL Analytics for Zone: ${zoneId}...`);

            // Dynamic Time Range
            const minutes = body.timeRange || 1440;
            const now = new Date();
            const since = new Date(now.getTime() - minutes * 60 * 1000);

            let targetSubdomain = body.subdomain;
            if (targetSubdomain === 'ALL_SUBDOMAINS') targetSubdomain = null;

            const isRoot = !targetSubdomain;

            const query = `
               query GetZoneAnalytics($zoneTag: String, $since: String, $until: String, $since_date: String, $until_date: String${targetSubdomain ? ', $host: String' : ''}) {
                 viewer {
                   zones(filter: { zoneTag: $zoneTag }) {
                     # Zone-wide Summary: Always fetched (1dGroups) for report total stats (no host filtering)
                     zoneSummary: httpRequests1dGroups(
                        limit: 1000
                        filter: {
                            date_geq: $since_date, date_leq: $until_date
                        }
                     ) {
                        sum {
                          requests
                          bytes
                          cachedRequests
                          cachedBytes
                          countryMap {
                            clientCountryName
                            requests
                            bytes
                          }
                        }
                     }
                     # ------------------------------

                     httpRequestsAdaptiveGroups(
                       filter: {
                           datetime_geq: $since,
                           datetime_leq: $until
                           ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''}
                       }
                       limit: 8000
                       orderBy: [count_DESC]
                     ) {
                       count
                       avg {
                         edgeTimeToFirstByteMs
                       }
                       dimensions {
                         clientRequestHTTPHost
                         clientIP
                         clientRequestPath
                         clientCountryName
                         userAgent
                         clientDeviceType
                         userAgentOS
                         edgeResponseStatus
                         datetimeMinute
                       }
                     }
                     
                     firewallActivity: firewallEventsAdaptiveGroups(
                        filter: {
                            datetime_geq: $since,
                            datetime_leq: $until
                            ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''}
                        }
                        limit: 5000
                        orderBy: [datetimeMinute_ASC]
                     ) {
                        count
                        dimensions {
                          action
                          datetimeMinute
                        }
                     }

                     # RULES: Aggregated by Rule Name & ID (Total Count)
                     firewallRules: firewallEventsAdaptiveGroups(
                        filter: {
                            datetime_geq: $since,
                            datetime_leq: $until
                            ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''}
                        }
                        limit: 500
                        orderBy: [count_DESC]
                     ) {
                        count
                        dimensions {
                          description
                          ruleId
                          source
                        }
                     }

                     firewallIPs: firewallEventsAdaptiveGroups(
                        filter: {
                            datetime_geq: $since,
                            datetime_leq: $until
                            ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''}
                        }
                        limit: 100
                        orderBy: [count_DESC]
                     ) {
                        count
                        dimensions {
                          clientIP
                          clientCountryName
                          action
                        }
                     }

                     firewallSources: firewallEventsAdaptiveGroups(
                        filter: {
                            datetime_geq: $since,
                            datetime_leq: $until
                            ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''}
                        }
                        limit: 100
                        orderBy: [count_DESC]
                     ) {
                        count
                        dimensions {
                          source
                        }
                     }
                   }
                 }
               }
             `;

            const variables = {
                zoneTag: zoneId,
                since: since.toISOString(),
                until: now.toISOString(),
                since_date: since.toISOString().split('T')[0],
                until_date: now.toISOString().split('T')[0],
            };

            if (targetSubdomain) {
                variables.host = targetSubdomain;
            }

            try {
                const response = await axios({
                    method: 'POST',
                    url: `${CLOUDFLARE_API_BASE}/graphql`,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    data: {
                        query: query,
                        variables: variables
                    }
                });

                if (response.data.errors) {
                    console.error('❌ Cloudflare GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
                }

                const zoneData = response.data?.data?.viewer?.zones?.[0];
                const httpGroups = zoneData?.httpRequestsAdaptiveGroups || [];

                // Extract separate firewall groups
                const firewallActivity = zoneData?.firewallActivity || [];
                const firewallRules = zoneData?.firewallRules || [];
                const firewallIPs = zoneData?.firewallIPs || [];
                const firewallSources = zoneData?.firewallSources || [];

                // console.log(`✅ GraphQL: ${httpGroups.length} HTTP, ${firewallActivity.length} Activity, ${firewallRules.length} Rules, ${firewallIPs.length} IPs, ${firewallSources.length} Sources`);

                console.log('🔹 API: Sending Traffic Response...');
                return NextResponse.json({
                    success: true,
                    data: {
                        httpRequestsAdaptiveGroups: httpGroups,
                        zoneSummary: zoneData?.zoneSummary || [],
                        firewallActivity,
                        firewallRules,
                        firewallIPs,
                        firewallSources
                    }
                });

            } catch (gqlError) {
                console.error('GraphQL Error:', gqlError.response?.data || gqlError.message);
                return NextResponse.json({
                    success: false,
                    message: 'GraphQL Error',
                    error: gqlError.response?.data
                }, { status: 500 });
            }

        }

        // 7. Get API Discovery (SDB System)
        else if (action === 'get-api-discovery') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            console.log(`🔍 Fetching API Discovery for Zone: ${zoneId}...`);

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            };

            try {
                // Use the API Gateway Discovery Endpoint directly (better than GraphQL for this)
                const response = await axios.get(
                    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/api_gateway/discovery`,
                    { headers }
                );

                const result = response.data;
                console.log('📦 Raw API Response Success:', result.success);

                if (result.success) {
                    let discoveries = [];

                    // Logic to handle different Cloudflare API response formats (Arrays, Objects, Schemas)
                    if (Array.isArray(result.result)) {
                        console.log('✅ result.result is an array with', result.result.length, 'elements');

                        if (result.result.length > 0) {
                            const firstItem = result.result[0];
                            // Flat Operations Format
                            if (firstItem.method && firstItem.endpoint) {
                                console.log('✅ Data is flat operations format!');
                                discoveries = result.result.map(op => ({
                                    id: op.id,
                                    host: op.host || '-',
                                    method: op.method || '-',
                                    path: op.endpoint || '-',
                                    state: op.state || '-',
                                    source: op.source || '-', // If available directly
                                    last_seen: op.last_updated || '-',
                                }));
                            }
                            // Nested Array/Schema Format
                            else if (Array.isArray(firstItem)) {
                                console.log('📋 Data is nested array format');
                                for (const item of result.result) {
                                    if (Array.isArray(item)) {
                                        // Flatten OpenAPI schemas
                                        for (const schema of item) {
                                            if (schema && schema.paths && typeof schema.paths === 'object') {
                                                const host = schema.info?.title?.replace('Schema for ', '') || '-';
                                                for (const [path, pathObj] of Object.entries(schema.paths)) {
                                                    for (const [method, methodObj] of Object.entries(pathObj)) {
                                                        if (typeof methodObj === 'object' && method !== 'parameters') {
                                                            discoveries.push({
                                                                host: host,
                                                                method: method.toUpperCase(),
                                                                path: path,
                                                                state: schema.state || methodObj['x-cf-api-discovery-state'] || 'review',
                                                                source: methodObj['x-cf-api-discovery-source']?.join(', ') || '-',
                                                                last_seen: schema.last_seen || schema.timestamp || '-',
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    } else if (result.result && typeof result.result === 'object') {
                        // Object Format (Schemas, endpoints, etc.)
                        console.log('⚠️ result.result is an object:', Object.keys(result.result));
                        let targetArray = [];

                        if (result.result.schemas) targetArray = result.result.schemas;
                        else if (result.result.discovered_origins) targetArray = result.result.discovered_origins;
                        else if (result.result.operations) targetArray = result.result.operations;
                        else if (result.result.endpoints) targetArray = result.result.endpoints;
                        else targetArray = Object.values(result.result).find(v => Array.isArray(v)) || [];

                        for (const schema of targetArray) {
                            if (schema && schema.paths && typeof schema.paths === 'object') {
                                const host = schema.info?.title?.replace('Schema for ', '') || '-';
                                for (const [path, pathObj] of Object.entries(schema.paths)) {
                                    for (const [method, methodObj] of Object.entries(pathObj)) {
                                        if (typeof methodObj === 'object' && method !== 'parameters') {
                                            discoveries.push({
                                                host: host,
                                                method: method.toUpperCase(),
                                                path: path,
                                                state: schema.state || methodObj['x-cf-api-discovery-state'] || 'review',
                                                source: methodObj['x-cf-api-discovery-source']?.join(', ') || '-',
                                                last_seen: schema.last_seen || schema.timestamp || '-',
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }

                    console.log(`✅ Discovery found ${discoveries.length} paths`);

                    return NextResponse.json({
                        success: true,
                        data: discoveries,
                        raw: result.result // Optional for debug
                    });

                } else {
                    console.error('API returned success: false', result.errors);
                    return NextResponse.json({ success: false, message: 'Cloudflare API Error', error: result.errors }, { status: 500 });
                }

            } catch (error) {
                console.error('Discovery API Error:', error.response?.data || error.message);
                return NextResponse.json({ success: false, message: 'Discovery API Failed' }, { status: 500 });
            }
        }

        // 8. Get Zone Settings (Bot Management, Security Level, etc.)
        else if (action === 'get-zone-settings') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            // console.log(`🔧 Fetching Zone Settings for: ${zoneId}...`);

            try {
                const headers = {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                };

                // Fetch multiple settings in parallel
                const [
                    securityLevelRes,
                    sslRes,
                    minTlsRes,
                    tls13Res,
                    dnsRecordsRes,
                    leakedCredsRes,
                    browserCheckRes,
                    hotlinkRes,
                    lockdownRes
                ] = await Promise.all([
                    // Security Level
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/security_level`, { headers }),
                    // SSL/TLS Mode
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/ssl`, { headers }),
                    // Minimum TLS Version
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/min_tls_version`, { headers }),
                    // TLS 1.3
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/tls_1_3`, { headers }),
                    // DNS Records
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records?per_page=1`, { headers }),
                    // Leaked Credentials Check
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/security_header`, { headers })
                        .catch(() => ({ data: { result: { value: 'unknown' } } })),
                    // Browser Integrity Check
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/browser_check`, { headers }),
                    // Hotlink Protection
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/hotlink_protection`, { headers }),
                    // Zone Lockdown Rules
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/lockdowns?per_page=1`, { headers })
                        .catch(() => ({ data: { result_info: { total_count: 0 } } }))
                ]);

                // Fetch Bot Management Configuration
                let botManagementConfig = null;
                try {
                    const botMgmtRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/bot_management`,
                        { headers }
                    );
                    botManagementConfig = botMgmtRes.data.result;
                    console.log(`\n🔍 [DEBUG] RAW BOT MANAGEMENT for Zone ${zoneId}:`);
                    console.log(JSON.stringify(botManagementConfig, null, 2));
                } catch (err) {
                    console.log('Bot Management not available (likely not Enterprise plan)');
                }

                // Fetch DDoS Protection Settings
                let ddosSettings = {
                    enabled: 'unknown',
                    httpDdos: 'unknown',
                    sslTlsDdos: 'unknown',
                    networkDdos: 'unknown'
                };
                try {
                    const ddosRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/ddos_protection`,
                        { headers }
                    ).catch(() => null);

                    if (ddosRes) {
                        ddosSettings.enabled = ddosRes.data.result?.value || 'on'; // Usually always on
                    }
                } catch (err) {
                    console.log('DDoS settings fetch failed');
                }

                // Fetch WAF Managed Rulesets
                let wafRulesets = {
                    cloudflareManaged: 'unknown',
                    owaspCore: 'unknown',
                    exposedCredentials: 'unknown',
                    ddosL7Ruleset: 'unknown',
                    managedRulesCount: 0,
                    rulesetActions: []
                };
                try {
                    const wafRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/http_request_firewall_managed/entrypoint`,
                        { headers }
                    ).catch(() => null);

                    if (wafRes && wafRes.data.result) {
                        const rules = wafRes.data.result.rules || [];

                        // Count total managed rules
                        wafRulesets.managedRulesCount = rules.filter(r => r.action === 'execute').length;

                        // Capture unique actions
                        const actions = [...new Set(rules.map(r => r.action))];
                        wafRulesets.rulesetActions = actions.join(', ');

                        // Check for Cloudflare Managed Ruleset
                        const cfManaged = rules.find(r => r.action === 'execute' && r.action_parameters?.id?.includes('efb7b8c949ac4650a09736fc376e9aee'));
                        wafRulesets.cloudflareManaged = cfManaged?.enabled ? 'enabled' : 'disabled';

                        // Check for OWASP Core Ruleset
                        const owasp = rules.find(r => r.action === 'execute' && r.action_parameters?.id?.includes('4814384a9e5d4991b9815dcfc25d2f1f'));
                        wafRulesets.owaspCore = owasp?.enabled ? 'enabled' : 'disabled';

                        // Check for Exposed Credentials Check
                        const exposedCreds = rules.find(r => r.action === 'execute' && r.action_parameters?.id?.includes('c2e184081120413c86c3ab7e14069605'));
                        wafRulesets.exposedCredentials = exposedCreds?.enabled ? 'enabled' : 'disabled';
                    }

                    // Fetch DDoS L7 Ruleset
                    const ddosL7Res = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/ddos_l7/entrypoint`,
                        { headers }
                    ).catch(() => null);

                    if (ddosL7Res && ddosL7Res.data.result) {
                        wafRulesets.ddosL7Ruleset = ddosL7Res.data.result.rules?.length > 0 ? 'enabled' : 'disabled';
                    }
                } catch (err) {
                    console.log('WAF Rulesets fetch failed');
                }

                // Fetch IP Access Rules details
                let ipAccessRulesData = [];
                try {
                    const ipRulesRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules?per_page=100`,
                        { headers }
                    ).catch(() => null);

                    if (ipRulesRes && ipRulesRes.data.result) {
                        // Extract relevant info: IP, action, scope
                        ipAccessRulesData = ipRulesRes.data.result.map(rule => ({
                            ip: rule.configuration?.value || 'unknown',
                            action: rule.mode || 'unknown', // e.g., "block", "challenge", "whitelist"
                            scope: rule.scope?.type || 'unknown', // e.g., "zone", "account", "user"
                            notes: rule.notes || ''
                        }));
                        // console.log(`✓ Found ${ipAccessRulesData.length} IP Access Rules`);
                        const scopes = [...new Set(ipAccessRulesData.map(r => r.scope))];
                        // console.log(`Debug API: IP Access Rules Scopes found: ${scopes.join(', ')}`);
                        if (ipAccessRulesData.length > 0) {
                            // console.log('Debug API: First rule sample:', JSON.stringify(ipAccessRulesData[0]));
                        }
                    }
                } catch (err) {
                    console.log('IP Access Rules fetch failed');
                }

                // Fetch Custom Rules (Firewall Rules)
                let customRulesData = {
                    status: 'None',
                    rules: []
                };
                try {
                    const customRulesRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/rules?per_page=100`,
                        { headers }
                    ).catch(() => null);

                    if (customRulesRes && customRulesRes.data.result) {
                        const rules = customRulesRes.data.result;
                        // Check if ANY rule is active (not paused)
                        const anyActive = rules.some(r => !r.paused);
                        customRulesData.status = rules.length > 0 ? (anyActive ? 'Enabled' : 'Disabled') : 'None';

                        customRulesData.rules = rules.map(r => ({
                            description: r.description || 'No Description',
                            action: r.action || 'unknown',
                            status: r.paused ? 'Disabled' : 'Enabled'
                        }));
                    }
                } catch (err) {
                    console.log('Custom Rules fetch failed');
                }

                // Fetch Rate Limiting Rules (Legacy + Rulesets)
                let rateLimitData = {
                    status: 'None',
                    rules: []
                };
                try {
                    // 1. Legacy Rate Limits
                    // console.log(`Fetching Legacy Rate Limits for ${zoneId}...`);
                    const rateLimitRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rate_limits?per_page=100`,
                        { headers }
                    ).catch(err => {
                        console.log('Legacy Rate Limit Error:', err.message);
                        return null;
                    });

                    if (rateLimitRes && rateLimitRes.data.result) {
                        const rules = rateLimitRes.data.result;
                        // console.log(`Found ${rules.length} Legacy Rate Limits`);
                        rules.forEach(r => {
                            rateLimitData.rules.push({
                                description: r.description || 'No Description',
                                match: r.match ? 'Custom Match' : 'All',
                                action: (r.action && typeof r.action === 'object' ? r.action.mode : r.action) || 'unknown',
                                status: r.disabled ? 'Disabled' : 'Enabled'
                            });
                        });
                    }

                    // 2. New Rate Limiting Rulesets (http_ratelimit)
                    // Note: Use 'http_ratelimit' phase for compatibility with most zones
                    const rateLimitRulesetRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`,
                        { headers }
                    ).catch(err => {
                        console.log('Ruleset Rate Limit fetch failed (api):', err.response?.status, err.response?.data?.errors?.[0]?.message);
                        return null;
                    });

                    if (rateLimitRulesetRes && rateLimitRulesetRes.data.result && rateLimitRulesetRes.data.result.rules) {
                        const rules = rateLimitRulesetRes.data.result.rules;
                        // console.log(`Found ${rules.length} Ruleset Rate Limits`);
                        rules.forEach(r => {
                            // Only include if not already present (check description)
                            if (!rateLimitData.rules.some(existing => existing.description === r.description)) {
                                rateLimitData.rules.push({
                                    description: r.description || 'Rate Limiting Rule',
                                    match: r.expression || 'Custom Match',
                                    action: r.action || 'unknown',
                                    status: r.enabled ? 'Enabled' : 'Disabled'
                                });
                            }
                        });
                    }

                    // console.log(`Total Rate Limits collected: ${rateLimitData.rules.length}`);

                    if (rateLimitData.rules.length > 0) {
                        const anyActive = rateLimitData.rules.some(r => r.status === 'Enabled');
                        rateLimitData.status = anyActive ? 'Enabled' : 'Disabled';
                    }

                } catch (err) {
                    console.log('Rate Limit Rules fetch failed', err.message);
                }

                const settings = {
                    // Security
                    // securityLevel removed as requested

                    // SSL/TLS
                    sslMode: sslRes.data.result?.value || 'unknown',
                    minTlsVersion: minTlsRes.data.result?.value || 'unknown',
                    tls13: tls13Res.data.result?.value || 'off',

                    // DNS
                    dnsRecordsCount: dnsRecordsRes.data.result_info?.total_count || 0,

                    // Security Features
                    leakedCredentials: leakedCredsRes.data.result?.value || 'unknown',
                    browserIntegrityCheck: browserCheckRes.data.result?.value || 'off',
                    hotlinkProtection: hotlinkRes.data.result?.value || 'off',
                    zoneLockdownRules: lockdownRes.data.result_info?.total_count || 0,

                    // DDoS Protection
                    ddosProtection: {
                        enabled: ddosSettings.enabled,
                        httpDdos: ddosSettings.httpDdos,
                        sslTlsDdos: ddosSettings.sslTlsDdos,
                        networkDdos: ddosSettings.networkDdos
                    },

                    // WAF Managed Rulesets
                    wafManagedRules: {
                        cloudflareManaged: wafRulesets.cloudflareManaged,
                        owaspCore: wafRulesets.owaspCore,
                        exposedCredentials: wafRulesets.exposedCredentials,
                        ddosL7Ruleset: wafRulesets.ddosL7Ruleset,
                        managedRulesCount: wafRulesets.managedRulesCount,
                        rulesetActions: wafRulesets.rulesetActions
                    },

                    // IP Access Rules
                    ipAccessRules: ipAccessRulesData,

                    // Custom Rules
                    customRules: customRulesData,

                    // Rate Limiting
                    rateLimits: rateLimitData,

                    // Bot Management
                    botManagement: {
                        enabled: botManagementConfig ? true : false,
                        // SBFM fields use sbfm_ prefix
                        definitelyAutomated: botManagementConfig?.sbfm_definitely_automated
                            ? (botManagementConfig.sbfm_definitely_automated.charAt(0).toUpperCase() + botManagementConfig.sbfm_definitely_automated.slice(1))
                            : 'unknown',
                        likelyAutomated: botManagementConfig?.sbfm_likely_automated
                            ? (botManagementConfig.sbfm_likely_automated.charAt(0).toUpperCase() + botManagementConfig.sbfm_likely_automated.slice(1))
                            : 'unknown',
                        verifiedBots: botManagementConfig?.sbfm_verified_bots
                            ? (botManagementConfig.sbfm_verified_bots.charAt(0).toUpperCase() + botManagementConfig.sbfm_verified_bots.slice(1))
                            : 'unknown',
                        blockAiBots: (botManagementConfig?.ai_bots_protection === 'block' ? 'Enabled' : (botManagementConfig?.ai_bots_protection ? 'Disabled' : 'unknown')),
                        superBotFightMode: botManagementConfig?.sbfm_definitely_automated ? true : false
                    }
                };

                // console.log(`✅ Settings fetched:`, settings);

                return NextResponse.json({
                    success: true,
                    data: settings
                });

            } catch (error) {
                console.error('Settings Fetch Error:', error.message);
                return NextResponse.json({
                    success: false,
                    message: 'Failed to fetch zone settings',
                    error: error.message
                }, { status: 500 });
            }
        }

        else {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('❌ Server Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ success: true, message: 'Cloudflare API Scraper Running' });
}
