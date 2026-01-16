import { NextResponse } from 'next/server';
import axios from 'axios';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

// ฟังก์ชันเรียก Cloudflare API REST ปกติ
async function callCloudflareAPI(endpoint, method = 'GET', data = null) {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!apiToken || apiToken === 'your-cloudflare-api-token-here') {
        throw new Error('กรุณาตั้งค่า CLOUDFLARE_API_TOKEN ใน .env.local');
    }

    const config = {
        method,
        url: `${CLOUDFLARE_API_BASE}${endpoint}`,
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
    };

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error('Cloudflare API Error:', error.response?.data || error.message);
        throw error;
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { action, zoneId, recordType, accountId } = body;

        // 1. Test Connection
        if (action === 'test') {
            console.log('🔐 Testing Cloudflare API Token...');
            const result = await callCloudflareAPI('/user/tokens/verify');
            return NextResponse.json({
                success: true,
                message: 'Connection successful!',
                data: result.result
            });

            // 2. List Zones (Domains)
        } else if (action === 'list-zones') {
            console.log('📋 Listing Zones...');
            let endpoint = '/zones';
            if (accountId) endpoint += `?account.id=${accountId}`;

            const result = await callCloudflareAPI(endpoint);
            const zones = result.result.map(zone => ({
                id: zone.id,
                name: zone.name,
                status: zone.status,
                plan: zone.plan.name,
                nameServers: zone.name_servers
            }));
            return NextResponse.json({ success: true, data: zones });

            // 3. Get DNS Records
        } else if (action === 'get-dns-records') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            console.log(`📝 Fetching DNS for Zone: ${zoneId}...`);

            let endpoint = `/zones/${zoneId}/dns_records?per_page=5000`; // Ensure we get all records
            if (recordType) endpoint += `&type=${recordType}`;

            const result = await callCloudflareAPI(endpoint);
            return NextResponse.json({ success: true, data: result.result });

            // 4. Get Account Info
        } else if (action === 'get-account-info') {
            console.log('👤 Fetching Account Info...');
            const result = await callCloudflareAPI('/accounts');
            const accounts = result.result.map(acc => ({
                id: acc.id,
                name: acc.name,
                type: acc.type
            }));
            return NextResponse.json({ success: true, data: accounts });

            // 5. Get API Discovery (Original)
        } else if (action === 'get-api-discovery') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            console.log(`🔍 Fetching API Discovery for Zone: ${zoneId}...`);

            // fetch max per page
            const endpoint = `/zones/${zoneId}/api_gateway/discovery?per_page=5000&order=method&direction=asc`;
            const result = await callCloudflareAPI(endpoint);

            let discoveries = [];
            // Parse Logic
            if (result.success) {
                if (Array.isArray(result.result)) {
                    // Flatten if nested
                    const flat = result.result.flat();
                    // Map to Standard Format
                    discoveries = flat.map(item => {
                        // Check different formats Cloudflare might return
                        if (item.endpoint) { // Simple format
                            return {
                                host: item.host || '-',
                                method: item.method,
                                path: item.endpoint
                            };
                        } else if (item.paths) { // Schema format
                            // Complex schema parsing omitted for brevity, use simpler result if possible
                            // Or return raw if structure is unknown
                            return { raw: item };
                        }
                        return item;
                    });

                    // If structure is complex schema, we might need the original deep parse logic
                    // But for now let's pass the raw result result if basic map fails
                    if (discoveries.length === 0 && result.result.length > 0) discoveries = result.result;
                }
            }

            return NextResponse.json({
                success: true,
                data: result.result // Return raw result mostly to let Frontend handle deep parsing if needed
            });

            // 6. Get Traffic Analytics (GraphQL) - NEW
        } else if (action === 'get-traffic-analytics') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            console.log(`📊 Fetching GraphQL Analytics for Zone: ${zoneId}...`);

            // Dynamic Time Range
            const minutes = body.timeRange || 1440;
            const now = new Date();
            const since = new Date(now.getTime() - minutes * 60 * 1000);
            const targetSubdomain = body.subdomain; // Receive Subdomain

            console.log(`🕒 Time Range: ${minutes}m | Subdomain: ${targetSubdomain || 'ALL'}`);

            // Query for httpRequestsAdaptiveGroups (Aggregated - Stable for Counts)
            // Using 'sum' for duration to calculate avg manually, avoiding 'avg' field issues if any
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
                       limit: 5000
                       orderBy: [count_DESC]
                     ) {
                       count
                       dimensions {
                         clientRequestHTTPHost
                         clientIP
                         clientRequestPath
                         clientCountryName
                         userAgent
                         clientDeviceType
                         userAgentOS
                         datetimeHour
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

                const data = response.data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
                console.log(`✅ GraphQL Groups returned ${data.length} groups for ${targetSubdomain || 'All'}`);

                return NextResponse.json({ success: true, data: data });

            } catch (gqlError) {
                console.error('GraphQL Error:', gqlError.response?.data || gqlError.message);
                return NextResponse.json({
                    success: false,
                    message: 'GraphQL Error',
                    error: gqlError.response?.data
                }, { status: 500 });
            }

        } else if (action === 'debug-check-datasets') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            const targetHost = body.subdomain || '140.softdebut.online'; // Default if validation needed

            console.log(`🔬 Debugging Datasets for ${targetHost} in Zone ${zoneId}...`);

            const now = new Date();
            const since = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 24 Hours

            // Query multiple datasets to compare count
            const query = `
               query CompareDatasets($zoneTag: string, $since: String, $until: String) {
                 viewer {
                   zones(filter: { zoneTag: $zoneTag }) {
                     
                     adaptive: httpRequestsAdaptiveGroups(
                       filter: { datetime_geq: $since, datetime_leq: $until }
                       limit: 2000
                     ) {
                       count
                       dimensions { clientRequestHTTPHost }
                     }

                     hourly: httpRequests1hGroups(
                       filter: { datetime_geq: $since, datetime_leq: $until }
                       limit: 2000
                     ) {
                       sum { requests }
                       dimensions { clientRequestHTTPHost }
                     }
                     
                     firewall: firewallEventsAdaptiveGroups(
                        filter: { datetime_geq: $since, datetime_leq: $until }
                        limit: 2000
                     ) {
                        count
                        dimensions { clientRequestHTTPHost }
                     }

                   }
                 }
               }
             `;

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
                        variables: {
                            zoneTag: zoneId,
                            since: since.toISOString(),
                            until: now.toISOString()
                        }
                    }
                });

                const zoneData = response.data?.data?.viewer?.zones?.[0];

                // Process & Filter in Backend to make it easy to read
                const filterHost = (arr, keyStr) => {
                    if (!arr) return 0;
                    return arr
                        .filter(i => (i.dimensions?.clientRequestHTTPHost || '').toLowerCase() === targetHost.toLowerCase())
                        .reduce((acc, i) => acc + (i.sum?.requests || i.count || 0), 0);
                };

                const result = {
                    target: targetHost,
                    counts: {
                        adaptive_requests: filterHost(zoneData?.adaptive, 'count'),
                        hourly_requests: filterHost(zoneData?.hourly, 'requests'),
                        firewall_events: filterHost(zoneData?.firewall, 'count')
                    },
                    raw_response: zoneData
                };

                console.log('🔬 Debug Result:', JSON.stringify(result.counts, null, 2));
                return NextResponse.json({ success: true, data: result });

            } catch (gqlError) {
                return NextResponse.json({ success: false, error: gqlError.message }, { status: 500 });
            }

        } else {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('❌ Server Error:', error.message);
        return NextResponse.json({
            success: false,
            message: error.message,
            error: error.response?.data
        }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Cloudflare API Scraper Running',
        available_actions: [
            'test', 'list-zones', 'get-dns-records', 'get-account-info', 'get-api-discovery', 'get-traffic-analytics'
        ]
    });
}
