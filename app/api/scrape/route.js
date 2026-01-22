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

                console.log(`✅ GraphQL: ${httpGroups.length} HTTP, ${firewallActivity.length} Activity, ${firewallRules.length} Rules, ${firewallIPs.length} IPs`);

                return NextResponse.json({
                    success: true,
                    data: httpGroups,
                    firewallActivity,
                    firewallRules,
                    firewallIPs
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
