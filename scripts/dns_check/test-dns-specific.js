const axios = require('axios');
const { getApiToken, colors, log } = require('../helpers');

// --- Configuration ---
const BASE_URL = 'http://localhost:8002/api/scrape';

// --- User Inputs ---
const TARGET_ACCOUNT = process.argv[2] || 'BDMS Group1';
const TARGET_ZONE = process.argv[3] || 'bdms.co.th';

async function main() {
    try {
        log(`🚀 Starting DNS Test for: [${TARGET_ACCOUNT}] -> [${TARGET_ZONE}]`, colors.cyan);

        // 1. Get Token from .env.local
        log('1. Getting API Token from .env.local...', colors.blue);
        const token = getApiToken();
        log(`   Token: ${token.substring(0, 4)}...${token.slice(-4)}`, colors.green);

        // 2. Find Account ID
        log(`2. Finding Account ID for "${TARGET_ACCOUNT}"...`, colors.blue);
        const accountRes = await axios.post(BASE_URL, { action: 'get-account-info', apiToken: token });
        if (!accountRes.data.success) throw new Error('Failed to fetch accounts: ' + accountRes.data.message);

        const accounts = accountRes.data.data;
        const targetAccount = accounts.find(a => a.name === TARGET_ACCOUNT);

        if (!targetAccount) {
            log(`❌ Account "${TARGET_ACCOUNT}" not found! Available accounts:`, colors.red);
            accounts.forEach(a => log(`   - ${a.name} (${a.id})`));
            return;
        }

        const accountId = targetAccount.id;
        log(`   ✅ Found Account ID: ${accountId}`, colors.green);

        // 3. Find Zone ID
        log(`3. Finding Zone ID for "${TARGET_ZONE}"...`, colors.blue);
        const zoneRes = await axios.post(BASE_URL, { action: 'list-zones', accountId: accountId, apiToken: token });
        if (!zoneRes.data.success) throw new Error('Failed to fetch zones: ' + zoneRes.data.message);

        const zones = zoneRes.data.data;
        const targetZone = zones.find(z => z.name === TARGET_ZONE);

        if (!targetZone) {
            log(`❌ Zone "${TARGET_ZONE}" not found in account "${TARGET_ACCOUNT}"! Available zones:`, colors.red);
            zones.forEach(z => log(`   - ${z.name} (${z.id})`));
            return;
        }

        const zoneId = targetZone.id;
        log(`   ✅ Found Zone ID: ${zoneId}`, colors.green);

        // 4. Get DNS Records
        log(`4. Fetching DNS Records...`, colors.blue);
        const dnsRes = await axios.post(BASE_URL, { action: 'get-dns-records', zoneId: zoneId, apiToken: token });

        if (!dnsRes.data.success) {
            log(`❌ Failed to fetch DNS: ${dnsRes.data.message}`, colors.red);
            return;
        }

        const dnsRecords = dnsRes.data.data;
        log(`   ✅ Retrieved ${dnsRecords.length} Total Records.`, colors.green);

        // Filter LBs
        const lbRecords = dnsRecords.filter(r => r.type === 'LB');
        log(`   🔎 Found ${lbRecords.length} Load Balancer (LB) records.`, colors.cyan);

        // Calculate Stats
        const stats = {
            types: {},
            proxied: 0,
            dnsOnly: 0
        };

        dnsRecords.forEach(r => {
            // Type Stats
            stats.types[r.type] = (stats.types[r.type] || 0) + 1;
            // Proxy Stats
            if (r.proxied) stats.proxied++;
            else stats.dnsOnly++;
        });

        log(`\n✅ Summary:`, colors.green);
        log(`   - Total DNS Records: ${dnsRecords.length}`, colors.green);
        log(`   -----------------------------`, colors.cyan);
        log(`   - By Type:`, colors.cyan);
        Object.keys(stats.types).forEach(type => {
            log(`     • ${type.padEnd(6)} : ${stats.types[type]}`, colors.reset);
        });
        log(`   -----------------------------`, colors.cyan);
        log(`   - By Status:`, colors.cyan);
        log(`     • Proxied (Orange) : ${stats.proxied}`, colors.reset);
        log(`     • DNS Only (Grey)  : ${stats.dnsOnly}`, colors.reset);
        log('============================================================\n', colors.green);

    } catch (error) {
        log(`❌ Error: ${error.message}`, colors.red);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
    }
}

main();
