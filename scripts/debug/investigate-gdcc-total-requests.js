const axios = require('axios');
const { getApiToken, colors, log } = require('../test-all/libs/api-helper');

const LOCAL_API_BASE = 'http://localhost:8002/api/scrape';
const CF_GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

const DEFAULT_ACCOUNT = 'Government Data Center and Cloud service (GDCC)';
const DEFAULT_ZONE = 'sesalpglpn.go.th';
const DEFAULT_HOST = 'www.sesalpglpn.go.th';
const TARGET_TOTAL = 1820000;

async function resolveZone(accountName, zoneName, apiToken) {
    const accountRes = await axios.post(LOCAL_API_BASE, {
        action: 'get-account-info',
        apiToken,
    });
    if (!accountRes.data?.success) {
        throw new Error(`Failed to fetch account info: ${accountRes.data?.message || 'unknown error'}`);
    }

    const account = (accountRes.data.data || []).find((item) => item.name === accountName);
    if (!account) throw new Error(`Account not found: ${accountName}`);

    const zoneRes = await axios.post(LOCAL_API_BASE, {
        action: 'list-zones',
        accountId: account.id,
        apiToken,
    });
    if (!zoneRes.data?.success) {
        throw new Error(`Failed to list zones: ${zoneRes.data?.message || 'unknown error'}`);
    }

    const zone = (zoneRes.data.data || []).find((item) => item.name === zoneName);
    if (!zone) throw new Error(`Zone not found: ${zoneName}`);

    return { account, zone };
}

async function runGraphQLQuery(query, variables, apiToken) {
    const response = await axios.post(
        CF_GRAPHQL_URL,
        { query, variables },
        {
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
        }
    );
    return response.data;
}

async function runCurrentDashboardPattern(zoneId, host, since, until, apiToken) {
    const query = `
        query CurrentPattern($zoneTag: String, $since: String, $until: String, $host: String) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(
                filter: {
                  datetime_geq: $since,
                  datetime_leq: $until,
                  clientRequestHTTPHost: $host
                }
                limit: 8000
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
                  edgeResponseStatus
                  datetimeMinute
                }
              }
            }
          }
        }
    `;

    const data = await runGraphQLQuery(query, { zoneTag: zoneId, since, until, host }, apiToken);
    const groups = data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
    const total = groups.reduce((sum, row) => sum + (row.count || 0), 0);
    return {
        label: 'current-dashboard-pattern',
        total,
        rows: groups.length,
        notes: groups.length >= 8000 ? 'Likely truncated: hit row limit 8000' : 'No row-limit hit detected',
        rawErrors: data?.errors || null,
    };
}

async function runAggregateHostPattern(zoneId, host, since, until, apiToken, label) {
    const query = `
        query AggregateHost($zoneTag: String, $since: String, $until: String, $host: String) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(
                filter: {
                  datetime_geq: $since,
                  datetime_leq: $until,
                  clientRequestHTTPHost: $host
                }
                limit: 5
              ) {
                count
              }
            }
          }
        }
    `;

    const data = await runGraphQLQuery(query, { zoneTag: zoneId, since, until, host }, apiToken);
    const total = data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups?.[0]?.count || 0;
    return {
        label,
        total,
        rows: data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups?.length || 0,
        notes: 'Host-filtered adaptive query without dimensions; Cloudflare returns one aggregate bucket',
        rawErrors: data?.errors || null,
    };
}

async function runZoneSummaryProbe(zoneId, sinceDate, untilDate, apiToken) {
    const query = `
        query ZoneSummary($zoneTag: String, $since_date: Date!, $until_date: Date!) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequests1dGroups(
                limit: 40,
                filter: { date_geq: $since_date, date_leq: $until_date }
              ) {
                dimensions { date }
                sum { requests bytes cachedRequests }
              }
            }
          }
        }
    `;

    const data = await runGraphQLQuery(query, { zoneTag: zoneId, since_date: sinceDate, until_date: untilDate }, apiToken);
    const rows = data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    const total = rows.reduce((sum, row) => sum + (row?.sum?.requests || 0), 0);
    return {
        label: 'zone-summary-1d-unfiltered',
        total,
        rows: rows.length,
        notes: 'Exact zone-wide 1d summary. No host filter support on this field.',
        rawErrors: data?.errors || null,
    };
}

function fmtNum(value) {
    return Number(value || 0).toLocaleString('en-US');
}

function fmtDiff(value) {
    const diff = Math.abs((value || 0) - TARGET_TOTAL);
    return Number(diff).toLocaleString('en-US');
}

async function main() {
    try {
        const apiToken = getApiToken();
        const accountName = process.argv[2] || DEFAULT_ACCOUNT;
        const zoneName = process.argv[3] || DEFAULT_ZONE;
        const host = process.argv[4] || DEFAULT_HOST;

        log('🔍 GDCC total-requests investigation', colors.cyan);
        log('════════════════════════════════════════════════════════════', colors.cyan);
        log(`Account: ${accountName}`, colors.blue);
        log(`Zone: ${zoneName}`, colors.blue);
        log(`Host: ${host}`, colors.blue);
        log(`Target: ~${fmtNum(TARGET_TOTAL)} requests`, colors.magenta);

        const { account, zone } = await resolveZone(accountName, zoneName, apiToken);
        log(`Resolved accountId: ${account.id}`, colors.green);
        log(`Resolved zoneId: ${zone.id}`, colors.green);

        const probes = [
            () => runCurrentDashboardPattern(zone.id, host, '2026-03-02T17:00:00.000Z', '2026-04-03T16:59:59.999Z', apiToken),
            () => runAggregateHostPattern(zone.id, host, '2026-03-03T00:00:00.000Z', '2026-04-03T23:59:59.999Z', apiToken, 'host-aggregate-utc-full-range'),
            () => runAggregateHostPattern(zone.id, host, '2026-03-03T00:00:00.000Z', '2026-04-03T00:00:00.000Z', apiToken, 'host-aggregate-utc-end-exclusive'),
            () => runAggregateHostPattern(zone.id, host, '2026-03-02T17:00:00.000Z', '2026-04-03T16:59:59.999Z', apiToken, 'host-aggregate-bkk-full-range'),
            () => runAggregateHostPattern(zone.id, host, '2026-03-02T17:00:00.000Z', '2026-04-02T17:00:00.000Z', apiToken, 'host-aggregate-bkk-end-exclusive'),
            () => runAggregateHostPattern(zone.id, host, '2026-02-28T17:00:00.000Z', '2026-03-31T16:59:59.999Z', apiToken, 'host-aggregate-march-only-bkk'),
            () => runZoneSummaryProbe(zone.id, '2026-03-03', '2026-04-03', apiToken),
        ];

        const results = [];
        for (const probe of probes) {
            const result = await probe();
            results.push(result);
            log(`\n• ${result.label}`, colors.yellow);
            log(`  total: ${fmtNum(result.total)}`, colors.green);
            log(`  rows: ${result.rows}`, colors.cyan);
            log(`  diff from 1.82M: ${fmtDiff(result.total)}`, colors.magenta);
            log(`  note: ${result.notes}`, colors.blue);
            if (result.rawErrors) {
                log(`  errors: ${JSON.stringify(result.rawErrors)}`, colors.red);
            }
        }

        const sorted = [...results].sort((a, b) => Math.abs(a.total - TARGET_TOTAL) - Math.abs(b.total - TARGET_TOTAL));
        const best = sorted[0];

        log('\n════════════════════════════════════════════════════════════', colors.cyan);
        log(`Best match: ${best.label}`, colors.green);
        log(`Best total: ${fmtNum(best.total)}`, colors.green);
        log(`Diff: ${fmtDiff(best.total)}`, colors.magenta);

        log('\nRecommendation:', colors.cyan);
        log('- The current dashboard pattern is using `httpRequestsAdaptiveGroups` with many dimensions and hits row-limit truncation.', colors.yellow);
        log('- For host-level total requests, the strongest candidate is `httpRequestsAdaptiveGroups` with the host filter and only `count` requested.', colors.yellow);
        log('- This avoids the 8000-row truncation because Cloudflare returns a single aggregate bucket for the host.', colors.yellow);

        log('\nRun again with custom values:', colors.cyan);
        log('node scripts/debug/investigate-gdcc-total-requests.js "Government Data Center and Cloud service (GDCC)" "sesalpglpn.go.th" "www.sesalpglpn.go.th"', colors.blue);
    } catch (error) {
        log(`\n❌ Investigation failed: ${error.message}`, colors.red);
        if (error.response?.data) {
            log(JSON.stringify(error.response.data, null, 2), colors.red);
        }
        process.exit(1);
    }
}

main();
