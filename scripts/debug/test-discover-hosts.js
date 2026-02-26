require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const axios = require('axios');

const ZONE_ID = process.env.TEST_ZONE_ID || '851fdfc9e064803dba9ed486b319a743';
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

const color = {
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

async function testDiscovery(token, since, until, label) {
    console.log(color.cyan(`\n── ${label} ──────────────────────────`));
    console.log(`   since: ${since.toISOString()}`);
    console.log(`   until: ${until.toISOString()}`);

    const query = `
        query DiscoverHosts($zoneTag: String, $since: String, $until: String) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until }
                limit: 500
                orderBy: [count_DESC]
              ) {
                count
                dimensions { clientRequestHTTPHost }
              }
            }
          }
        }
    `;

    try {
        const res = await axios({
            method: 'POST',
            url: GRAPHQL_URL,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            data: { query, variables: { zoneTag: ZONE_ID, since: since.toISOString(), until: until.toISOString() } }
        });

        if (res.data?.errors) {
            console.log(color.red(`   ❌ GraphQL Errors: ${JSON.stringify(res.data.errors, null, 2)}`));
            return;
        }

        const groups = res.data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
        console.log(color.bold(`   Found: ${groups.length} host groups`));

        if (groups.length === 0) {
            console.log(color.yellow('   ⚠️  0 results — no traffic data found in this time window'));
        } else {
            groups.slice(0, 10).forEach(g => {
                console.log(color.green(`   ✅ ${g.dimensions?.clientRequestHTTPHost} (${g.count} requests)`));
            });
            if (groups.length > 10) {
                console.log(`   ... and ${groups.length - 10} more`);
            }
        }
    } catch (e) {
        const status = e.response?.status;
        console.log(color.red(`   ❌ HTTP ${status || 'Error'}: ${e.message}`));
        if (e.response?.data) console.log(JSON.stringify(e.response.data, null, 2));
    }
}

(async () => {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!token) {
        console.error(color.red('❌ CLOUDFLARE_API_TOKEN not set in .env.local'));
        process.exit(1);
    }

    console.log(color.bold(`\n🔍 Testing Subdomain Discovery for Zone: ${ZONE_ID}\n`));

    const now = new Date();

    // Test multiple time windows
    const windows = [
        { days: 1, label: '1 day (yesterday)' },
        { days: 7, label: '7 days' },
        { days: 30, label: '30 days' },
    ];

    for (const w of windows) {
        const since = new Date(now);
        since.setUTCDate(since.getUTCDate() - w.days);
        since.setUTCHours(0, 0, 0, 0);
        await testDiscovery(token, since, now, w.label);
    }

    console.log(color.cyan('\n── Done ───────────────────────────────\n'));
})();
