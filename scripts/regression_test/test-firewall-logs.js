require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const helpers = require('../helpers');
const { log, colors } = helpers;

// --- Configuration ---
const BASE_URL = 'http://localhost:8002/api/scrape'; // Assuming local dev server or adjust port
const TARGET_ACCOUNT_KEYWORD = 'Siam Cement Public Company Limited (SCG)';
const TARGET_ZONE_NAME = 'scg.com';
const TARGET_RULE_ID = '18e96f1b9dc044daa9f5a3d302bda61d';

async function runTest() {
    log('🚀 Starting Firewall Logs Regression Test...', colors.cyan);

    // 1. Get Firewall API Token
    const apiToken = process.env.CLOUDFLARE_FIREWALL_API_TOKEN;
    if (!apiToken) {
        log('❌ No CLOUDFLARE_FIREWALL_API_TOKEN found in .env.local', colors.red);
        process.exit(1);
    }
    log(`🔑 Using Firewall API Token: ${apiToken.substring(0, 10)}...`, colors.gray);

    try {
        // 2. Search for Account
        log('\n📌 Step 1: Finding Account...', colors.yellow);
        const accountRes = await axios.post(BASE_URL, {
            action: 'get-account-info',
            apiToken,
            useFirewallToken: true
        });

        if (!accountRes.data.success) {
            throw new Error(`Failed to fetch accounts: ${accountRes.data.message}`);
        }

        const accounts = accountRes.data.data;
        log(`   Found ${accounts.length} accounts: ${accounts.map(a => a.name).join(', ')}`, colors.gray);

        let targetAccount = accounts.find(a => a.name.toLowerCase().includes(TARGET_ACCOUNT_KEYWORD.toLowerCase()));

        if (!targetAccount) {
            log(`   ⚠️ Target Account '${TARGET_ACCOUNT_KEYWORD}' not found. Falling back to first available account.`, colors.yellow);
            targetAccount = accounts[0];
            if (!targetAccount) throw new Error('No accounts available to test with.');
        }
        log(`   ✅ Target Account: ${targetAccount.name} (${targetAccount.id})`, colors.green);


        // 3. Search for Zone
        log('\n📌 Step 2: Finding Zone...', colors.yellow);
        const zoneRes = await axios.post(BASE_URL, {
            action: 'list-zones',
            accountId: targetAccount.id,
            apiToken,
            useFirewallToken: true
        });

        if (!zoneRes.data.success) {
            throw new Error(`Failed to fetch zones: ${zoneRes.data.message}`);
        }

        const zones = zoneRes.data.data;
        let targetZone = zones.find(z => z.name === TARGET_ZONE_NAME);

        if (!targetZone) {
            log(`   ⚠️ Target Zone '${TARGET_ZONE_NAME}' not found. Falling back to first available zone.`, colors.yellow);
            targetZone = zones[0];
            if (!targetZone) throw new Error(`No zones found in account ${targetAccount.name}`);
        }
        log(`   ✅ Target Zone: ${targetZone.name} (${targetZone.id})`, colors.green);


        // 4. Test Fetch Firewall Logs
        log(`\n📌 Step 3: Fetching Firewall Logs (Rule: ${TARGET_RULE_ID})...`, colors.yellow);

        const logsRes = await axios.post(BASE_URL, {
            action: 'get-firewall-logs',
            zoneId: targetZone.id,
            ruleId: TARGET_RULE_ID,
            timeRange: 1440, // 24 Hours
            apiToken,
            useFirewallToken: true
        });

        if (!logsRes.data.success) {
            throw new Error(`Fetch Logs Failed: ${logsRes.data.message}`);
        }

        const logs = logsRes.data.data;
        log(`   ✅ API Status: Success`, colors.green);
        log(`   📊 Logs Found: ${logs.length}`, colors.cyan);

        if (logs.length > 0) {
            const firstLog = logs[0];
            log('\n🔍 First Log Detail:', colors.magenta);
            console.log(JSON.stringify({
                datetime: firstLog.datetime,
                action: firstLog.action,
                ip: firstLog.clientIP,
                country: firstLog.clientCountryName,
                ruleId: firstLog.ruleId,
                source: firstLog.source
            }, null, 2));
        } else {
            log('   ⚠️ No logs returned (This is expected if no events matched the rule in last 24h)', colors.yellow);
        }

        log('\n✅ Regression Test Passed!', colors.green);

    } catch (error) {
        log(`\n❌ Test Failed: ${error.message}`, colors.red);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        process.exit(1);
    }
}

runTest();
