const axios = require('axios');
const { getApiToken, colors, log } = require('../helpers');

const BASE_URL = 'http://localhost:8002/api/scrape';

async function main() {
    try {
        log('🔍 Finding Active Zones...', colors.cyan);

        const apiToken = getApiToken();
        log(`✅ Token: ${apiToken.substring(0, 4)}...${apiToken.slice(-4)}`, colors.green);

        // Get accounts
        const accountRes = await axios.post(BASE_URL, {
            action: 'get-account-info',
            apiToken
        });

        if (!accountRes.data.success) {
            throw new Error('Failed to fetch accounts');
        }

        const accounts = accountRes.data.data;
        log(`\n📊 Found ${accounts.length} accounts`, colors.blue);

        for (const account of accounts) {
            log(`\n--- Account: ${account.name} (${account.id}) ---`, colors.cyan);

            // Get zones for this account
            const zoneRes = await axios.post(BASE_URL, {
                action: 'list-zones',
                accountId: account.id,
                apiToken
            });

            if (!zoneRes.data.success) {
                log(`  ❌ Failed to fetch zones`, colors.red);
                continue;
            }

            const zones = zoneRes.data.data;
            log(`  Zones: ${zones.length}`, colors.blue);

            for (const zone of zones) {
                log(`    • ${zone.name} (${zone.status})`, zone.status === 'active' ? colors.green : colors.yellow);
            }
        }

        log('\n✅ Complete', colors.green);
    } catch (error) {
        log(`❌ Error: ${error.message}`, colors.red);
    }
}

main();
