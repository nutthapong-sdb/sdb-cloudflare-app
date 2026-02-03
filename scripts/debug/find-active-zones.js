const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// --- Configuration ---
const API_BASE_URL = 'http://localhost:8002/api/scrape';
const DB_PATH = path.join(__dirname, '../../db/sdb_users.db');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

async function getApiTokenFromDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(new Error(`Could not connect to database: ${err.message}`));
        });
        const sql = `SELECT cloudflare_api_token FROM users WHERE cloudflare_api_token IS NOT NULL AND cloudflare_api_token != '' LIMIT 1`;
        db.get(sql, [], (err, row) => {
            db.close();
            if (err) return reject(err);
            if (row && row.cloudflare_api_token) resolve(row.cloudflare_api_token);
            else reject(new Error('No API Token found in database.'));
        });
    });
}

async function main() {
    log('🔍 Finding Active Zones with Traffic Data...', colors.cyan);
    log('---------------------------------------------');

    let apiToken;
    try {
        apiToken = await getApiTokenFromDb();
        log('✅ Retrieved API Token.\n');
    } catch (e) {
        log(`❌ Error: ${e.message}`, colors.red);
        process.exit(1);
    }

    const headers = { 'Content-Type': 'application/json' };
    const callAPI = (action, params) => axios.post(API_BASE_URL, { action, ...params, apiToken }, { headers }).then(r => r.data);

    try {
        // 1. Get All Accounts
        log('1. Fetching Accounts...', colors.blue);
        const accRes = await callAPI('get-account-info', {});
        if (!accRes.success) throw new Error(`Account API Failed: ${accRes.message}`);

        const accounts = accRes.data;
        log(`   Found ${accounts.length} account(s)\n`);

        const activeZones = [];

        // 2. Loop through each account
        for (const account of accounts) {
            log(`📂 Checking Account: ${account.name}`, colors.yellow);

            // Get zones for this account
            const zoneRes = await callAPI('list-zones', { accountId: account.id });
            if (!zoneRes.success) {
                log(`   ⚠️ Could not fetch zones: ${zoneRes.message}`, colors.yellow);
                continue;
            }

            const zones = zoneRes.data;
            log(`   Found ${zones.length} zone(s)`);

            // 3. Check each zone for traffic data
            for (const zone of zones) {
                process.stdout.write(`   🌐 ${zone.name.padEnd(30)} ... `);

                try {
                    // Query for last 7 days (1440 * 7 = 10080 minutes)
                    const trafficRes = await callAPI('get-traffic-analytics', {
                        zoneId: zone.id,
                        timeRange: 10080,
                        subdomain: null // ALL_SUBDOMAINS
                    });

                    if (!trafficRes.success) {
                        console.log(`${colors.yellow}API Error${colors.reset}`);
                        continue;
                    }

                    const tData = trafficRes.data || {};
                    const httpRequests = tData.httpRequestsAdaptiveGroups || [];
                    const firewallRules = tData.firewallRules || [];
                    const zoneSummary = tData.zoneSummary || [];

                    const totalRequests = httpRequests.reduce((sum, r) => sum + (r.count || 0), 0);
                    const zoneRequests = zoneSummary.reduce((sum, r) => sum + (r.sum.requests || 0), 0);

                    if (totalRequests > 0 || zoneRequests > 0 || httpRequests.length > 0) {
                        console.log(`${colors.green}✓ ACTIVE${colors.reset} (Requests: ${totalRequests.toLocaleString()}, Data Groups: ${httpRequests.length})`);
                        activeZones.push({
                            account: account.name,
                            accountId: account.id,
                            zone: zone.name,
                            zoneId: zone.id,
                            requests: totalRequests,
                            dataGroups: httpRequests.length,
                            firewallRules: firewallRules.length,
                            hasTopHost: httpRequests[0]?.dimensions?.clientRequestHTTPHost ? true : false,
                            hasCustomRules: firewallRules.some(r => (r.dimensions?.source || '').toLowerCase().includes('custom')),
                            hasManagedRules: firewallRules.some(r => (r.dimensions?.source || '').toLowerCase().includes('managed'))
                        });
                    } else {
                        console.log(`${colors.yellow}✗ EMPTY${colors.reset}`);
                    }
                } catch (err) {
                    console.log(`${colors.red}ERROR: ${err.message}${colors.reset}`);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            console.log('');
        }

        // 4. Report Results
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
        log('📊 ACTIVE ZONES SUMMARY', colors.cyan);
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);

        if (activeZones.length === 0) {
            log('⚠️ No active zones found with traffic data in the last 7 days.', colors.yellow);
        } else {
            activeZones.forEach((z, idx) => {
                log(`${idx + 1}. ${z.zone}`, colors.green);
                log(`   Account: ${z.account}`);
                log(`   Requests: ${z.requests.toLocaleString()}`);
                log(`   Data Groups: ${z.dataGroups}`);
                log(`   Firewall Rules: ${z.firewallRules}`);
                log(`   Has @TOP_HOST_VAL: ${z.hasTopHost ? colors.green + '✓' + colors.reset : colors.yellow + '✗' + colors.reset}`);
                log(`   Has @TOP_CUSTOM_RULES_LIST: ${z.hasCustomRules ? colors.green + '✓' + colors.reset : colors.yellow + '✗' + colors.reset}`);
                log(`   Has @TOP_MANAGED_RULES_LIST: ${z.hasManagedRules ? colors.green + '✓' + colors.reset : colors.yellow + '✗' + colors.reset}`);
                console.log('');
            });

            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
            log('💡 Recommendation for Testing:', colors.cyan);
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);

            const bestZone = activeZones.reduce((best, current) => {
                const currentScore = (current.hasTopHost ? 1 : 0) + (current.hasCustomRules ? 1 : 0) + (current.hasManagedRules ? 1 : 0) + (current.requests / 1000);
                const bestScore = (best.hasTopHost ? 1 : 0) + (best.hasCustomRules ? 1 : 0) + (best.hasManagedRules ? 1 : 0) + (best.requests / 1000);
                return currentScore > bestScore ? current : best;
            });

            log(`Update TARGET_CONFIG in test-template-variables.js to:`, colors.yellow);
            log(`\nconst TARGET_CONFIG = {`);
            log(`    accountName: "${bestZone.account}",`);
            log(`    zoneName: "${bestZone.zone}",`);
            log(`    subDomain: "ALL_SUBDOMAINS",`);
            log(`    timeRange: 10080  // 7 days`);
            log(`};\n`);
        }

    } catch (e) {
        log(`❌ Error: ${e.message}`, colors.red);
        if (e.stack) console.log(e.stack);
    }
}

main();
