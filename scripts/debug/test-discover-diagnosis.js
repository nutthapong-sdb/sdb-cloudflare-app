require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const axios = require('axios');

const ZONE_ID = process.env.TEST_ZONE_ID || '851fdfc9e064803dba9ed486b319a743';
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

const c = {
    g: (s) => `\x1b[32m${s}\x1b[0m`,
    y: (s) => `\x1b[33m${s}\x1b[0m`,
    r: (s) => `\x1b[31m${s}\x1b[0m`,
    b: (s) => `\x1b[36m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const token = process.env.CLOUDFLARE_API_TOKEN;
const gql = (query, variables) => axios({
    method: 'POST', url: GRAPHQL_URL,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { query, variables }
});

(async () => {
    if (!token) { console.error(c.r('❌ CLOUDFLARE_API_TOKEN not set')); process.exit(1); }

    const now = new Date();
    const since30 = new Date(now); since30.setUTCDate(since30.getUTCDate() - 30); since30.setUTCHours(0, 0, 0, 0);
    const since7 = new Date(now); since7.setUTCDate(since7.getUTCDate() - 7); since7.setUTCHours(0, 0, 0, 0);
    const since1 = new Date(now); since1.setUTCDate(since1.getUTCDate() - 1); since1.setUTCHours(0, 0, 0, 0);

    const vars = {
        zoneTag: ZONE_ID,
        since: since30.toISOString(),
        until: now.toISOString(),
        since_date: since30.toISOString().split('T')[0],
        until_date: now.toISOString().split('T')[0],
    };

    console.log(c.bold(`\n🔬 Deep Diagnosis — Zone: ${ZONE_ID}\n`));

    // ─── Test 1: Same full query as fetchCloudflareAnalytics (no host filter) ───
    console.log(c.b('Test 1: Full analytics query (same as fetchCloudflareAnalytics, no host filter, 30d)'));
    try {
        const res = await gql(`
            query($zoneTag: String, $since: String, $until: String, $since_date: String, $until_date: String) {
              viewer { zones(filter: { zoneTag: $zoneTag }) {
                zoneSummary: httpRequests1dGroups(limit:10, filter:{date_geq:$since_date,date_leq:$until_date}) {
                  sum { requests bytes }
                }
                httpRequestsAdaptiveGroups(filter:{datetime_geq:$since,datetime_leq:$until} limit:10 orderBy:[count_DESC]) {
                  count dimensions { clientRequestHTTPHost }
                }
              }}
            }`, vars);
        const z = res.data?.data?.viewer?.zones?.[0];
        const days = z?.zoneSummary || [];
        const groups = z?.httpRequestsAdaptiveGroups || [];
        const totalReq = days.reduce((s, d) => s + (d.sum?.requests || 0), 0);
        console.log(c.bold(`   zoneSummary days: ${days.length}, total requests: ${totalReq.toLocaleString()}`));
        console.log(c.bold(`   adaptive groups: ${groups.length}`));
        groups.slice(0, 5).forEach(g => console.log(c.g(`   → ${g.dimensions?.clientRequestHTTPHost} (${g.count})`)));
        if (res.data?.errors) console.log(c.r('   Errors: ' + JSON.stringify(res.data.errors)));
    } catch (e) { console.log(c.r(`   ❌ ${e.response?.status} ${e.message}`)); }

    // ─── Test 2: httpRequests1dGroups with hostCountry dimension ───
    console.log(c.b('\nTest 2: httpRequestsAdaptiveGroups with only count (no dimensions) 7d'));
    try {
        const res = await gql(`
            query($zoneTag: String, $since: String, $until: String) {
              viewer { zones(filter: { zoneTag: $zoneTag }) {
                httpRequestsAdaptiveGroups(filter:{datetime_geq:$since,datetime_leq:$until} limit:10) {
                  count
                }
              }}
            }`, { ...vars, since: since7.toISOString() });
        const groups = res.data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
        const total = groups.reduce((s, g) => s + g.count, 0);
        console.log(c.bold(`   groups: ${groups.length}, total count: ${total.toLocaleString()}`));
        if (res.data?.errors) console.log(c.r('   Errors: ' + JSON.stringify(res.data.errors)));
    } catch (e) { console.log(c.r(`   ❌ ${e.response?.status} ${e.message}`)); }

    // ─── Test 3: Try with just 1 day range ───
    console.log(c.b('\nTest 3: httpRequestsAdaptiveGroups with host dimension, 1d'));
    try {
        const res = await gql(`
            query($zoneTag: String, $since: String, $until: String) {
              viewer { zones(filter: { zoneTag: $zoneTag }) {
                httpRequestsAdaptiveGroups(filter:{datetime_geq:$since,datetime_leq:$until} limit:20 orderBy:[count_DESC]) {
                  count dimensions { clientRequestHTTPHost edgeResponseStatus }
                }
              }}
            }`, { ...vars, since: since1.toISOString() });
        const groups = res.data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
        console.log(c.bold(`   groups: ${groups.length}`));
        groups.slice(0, 5).forEach(g => console.log(c.g(`   → host: ${g.dimensions?.clientRequestHTTPHost}, status: ${g.dimensions?.edgeResponseStatus}, count: ${g.count}`)));
        if (res.data?.errors) console.log(c.r('   Errors: ' + JSON.stringify(res.data.errors)));
    } catch (e) { console.log(c.r(`   ❌ ${e.response?.status} ${e.message}`)); }

    // ─── Test 4: REST API — check zone basic info ───
    console.log(c.b('\nTest 4: REST API — zone info'));
    try {
        const res = await axios.get(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const z = res.data?.result;
        console.log(c.bold(`   Zone name: ${z?.name}, status: ${z?.status}, plan: ${z?.plan?.name}`));
    } catch (e) { console.log(c.r(`   ❌ ${e.response?.status} ${e.message}`)); }

    // ─── Test 5: GraphQL full same as live dashboard ───
    console.log(c.b('\nTest 5: 24h live range (same as dashboard default)'));
    try {
        const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const res = await gql(`
            query($zoneTag: String, $since: String, $until: String) {
              viewer { zones(filter: { zoneTag: $zoneTag }) {
                httpRequestsAdaptiveGroups(filter:{datetime_geq:$since,datetime_leq:$until} limit:20 orderBy:[count_DESC]) {
                  count dimensions { clientRequestHTTPHost }
                }
              }}
            }`, { ...vars, since: since24h.toISOString() });
        const groups = res.data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
        console.log(c.bold(`   groups: ${groups.length}`));
        groups.slice(0, 10).forEach(g => console.log(c.g(`   → ${g.dimensions?.clientRequestHTTPHost} (${g.count})`)));
        if (res.data?.errors) console.log(c.r('   Errors: ' + JSON.stringify(res.data.errors)));
    } catch (e) { console.log(c.r(`   ❌ ${e.response?.status} ${e.message}`)); }

    console.log(c.b('\n── Done ───────────────────────────────\n'));
})();
