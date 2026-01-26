import { NextResponse } from 'next/server';
import axios from 'axios';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

export async function POST(request) {
    try {
        const body = await request.json();
        const { action, zoneId, accountId } = body;

        console.log(`🔔 API Action: ${action}`);

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

            console.log(`📋 Listing Zones for Account: ${accountId || 'All'}...`);
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
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

        // 3. Get DNS Records (Subdomains)
        else if (action === 'get-dns-records') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            console.log(`📝 Fetching DNS for Zone: ${zoneId}...`);

            const response = await axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`, {
                headers: {
                    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                }
            });

            return NextResponse.json({ success: true, data: response.data.result });
        }

        // 4. Get Account Info
        else if (action === 'get-account-info') {
            console.log(`👤 Fetching Account Info...`);
            const response = await axios.get(`${CLOUDFLARE_API_BASE}/accounts`, {
                headers: {
                    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                }
            });

            return NextResponse.json({ success: true, data: response.data.result });
        }

        // 6. Get Traffic Analytics (GraphQL) - MAIN DASHBOARD
        else if (action === 'get-traffic-analytics') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            console.log(`📊 Fetching GraphQL Analytics for Zone: ${zoneId}...`);

            // Dynamic Time Range
            const minutes = body.timeRange || 1440;
            const now = new Date();
            const since = new Date(now.getTime() - minutes * 60 * 1000);
            const targetSubdomain = body.subdomain;

            console.log(`🕒 Time Range: ${minutes}m | Subdomain: ${targetSubdomain || 'ALL'}`);

            const query = `
               query GetZoneAnalytics($zoneTag: string, $since: String, $until: String${targetSubdomain ? ', $host: String' : ''}) {
                 viewer {
                   zones(filter: { zoneTag: $zoneTag }) {
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
                until: now.toISOString()
            };

            if (targetSubdomain) {
                variables.host = targetSubdomain;
            }

            try {
                const response = await axios({
                    method: 'POST',
                    url: `${CLOUDFLARE_API_BASE}/graphql`,
                    headers: {
                        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    data: {
                        query: query,
                        variables: variables
                    }
                });

                const zoneData = response.data?.data?.viewer?.zones?.[0];
                const httpGroups = zoneData?.httpRequestsAdaptiveGroups || [];

                // Extract separate firewall groups
                const firewallActivity = zoneData?.firewallActivity || [];
                const firewallRules = zoneData?.firewallRules || [];
                const firewallIPs = zoneData?.firewallIPs || [];
                const firewallSources = zoneData?.firewallSources || [];

                console.log(`✅ GraphQL: ${httpGroups.length} HTTP, ${firewallActivity.length} Activity, ${firewallRules.length} Rules, ${firewallIPs.length} IPs, ${firewallSources.length} Sources`);

                return NextResponse.json({
                    success: true,
                    data: httpGroups,
                    firewallActivity,
                    firewallRules,
                    firewallIPs,
                    firewallSources
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

            const query = `
               query GetAPIDiscovery($zoneTag: string, $since: String, $until: String) {
                 viewer {
                   zones(filter: { zoneTag: $zoneTag }) {
                     httpRequestsAdaptiveGroups(
                       filter: {
                           datetime_geq: $since,
                           datetime_leq: $until
                       }
                       limit: 1500
                       orderBy: [count_DESC]
                     ) {
                       count
                       dimensions {
                         clientRequestHTTPHost
                         clientRequestPath
                         edgeResponseStatus
                       }
                     }
                   }
                 }
               }
             `;

            // Last 7 Days (Increased from 24h to ensure data is found)
            const now = new Date();
            const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            console.log(`📅 Discovery Time Range: ${since.toISOString()} to ${now.toISOString()}`);

            const variables = {
                zoneTag: zoneId,
                since: since.toISOString(),
                until: now.toISOString()
            };

            try {
                const response = await axios({
                    method: 'POST',
                    url: `${CLOUDFLARE_API_BASE}/graphql`,
                    headers: {
                        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    data: { query, variables }
                });

                const zoneData = response.data?.data?.viewer?.zones?.[0];
                const rawGroups = zoneData?.httpRequestsAdaptiveGroups || [];

                // Transform to simpler format for the table
                const processedData = rawGroups.map(item => ({
                    method: 'N/A', // Method field removed to ensure compatibility
                    host: item.dimensions?.clientRequestHTTPHost || 'unknown',
                    path: item.dimensions?.clientRequestPath || '/',
                    state: item.dimensions?.edgeResponseStatus || '0',
                    source: 'unknown', // Source removed from query to ensure stability
                    count: item.count
                }));

                console.log(`✅ Discovery found ${processedData.length} paths`);

                return NextResponse.json({
                    success: true,
                    data: processedData,
                    raw: rawGroups // Optional for debug
                });

            } catch (gqlError) {
                console.error('GraphQL Discovery Error:', gqlError.response?.data || gqlError.message);
                return NextResponse.json({ success: false, message: 'Discovery GraphQL Failed' }, { status: 500 });
            }
        }

        // 8. Get Zone Settings (Bot Management, Security Level, etc.)
        else if (action === 'get-zone-settings') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            console.log(`🔧 Fetching Zone Settings for: ${zoneId}...`);

            try {
                const headers = {
                    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
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

                // Fetch IP Access Rules count
                let ipAccessRulesCount = 0;
                try {
                    const ipRulesRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules?per_page=1`,
                        { headers }
                    ).catch(() => null);

                    if (ipRulesRes) {
                        ipAccessRulesCount = ipRulesRes.data.result_info?.total_count || 0;
                    }
                } catch (err) {
                    console.log('IP Access Rules fetch failed');
                }

                const settings = {
                    // Security
                    securityLevel: securityLevelRes.data.result?.value || 'unknown',

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
                    ipAccessRules: ipAccessRulesCount,

                    // Bot Management
                    botManagement: {
                        enabled: botManagementConfig ? true : false,
                        definitelyAutomated: botManagementConfig?.fight_mode?.definitely_automated || 'unknown',
                        likelyAutomated: botManagementConfig?.fight_mode?.likely_automated || 'unknown',
                        verifiedBots: botManagementConfig?.fight_mode?.verified_bots || 'allow',
                        blockAiBots: botManagementConfig?.ai_bots_protection?.mode || 'unknown',
                        superBotFightMode: botManagementConfig?.sbfm?.enabled || false
                    }
                };

                console.log(`✅ Settings fetched:`, settings);

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
