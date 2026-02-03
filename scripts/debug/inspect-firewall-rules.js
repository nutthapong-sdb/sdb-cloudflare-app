const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// --- Configuration ---
const API_BASE_URL = 'http://localhost:8002/api/scrape';
const DB_PATH = path.join(__dirname, '../../db/sdb_users.db');

const TARGET_CONFIG = {
    accountName: "BDMS Group1",
    zoneName: "bdms.co.th",
    timeRange: 43200 // 30 days
};

async function getApiTokenFromDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
        const sql = `SELECT cloudflare_api_token FROM users WHERE cloudflare_api_token IS NOT NULL LIMIT 1`;
        db.get(sql, [], (err, row) => {
            db.close();
            if (err) return reject(err);
            resolve(row.cloudflare_api_token);
        });
    });
}

async function main() {
    console.log('🚀 Inspecting Firewall Rules Data...');
    const apiToken = await getApiTokenFromDb();

    // 1. Get Zone ID
    const accRes = await axios.post(API_BASE_URL, { action: 'get-account-info', apiToken });
    const account = accRes.data.data.find(a => a.name.includes(TARGET_CONFIG.accountName));

    const zoneRes = await axios.post(API_BASE_URL, { action: 'list-zones', accountId: account.id, apiToken });
    const zone = zoneRes.data.data.find(z => z.name === TARGET_CONFIG.zoneName);

    console.log(`Debug: Zone ID = ${zone.id}`);

    // 2. Fetch Traffic Analytics (which includes firewallRules)
    const res = await axios.post(API_BASE_URL, {
        action: 'get-traffic-analytics',
        zoneId: zone.id,
        timeRange: TARGET_CONFIG.timeRange,
        apiToken
    });

    if (!res.data.success) {
        console.error('API Failed:', res.data.message);
        return;
    }

    const { firewallRules, firewallSources } = res.data.data;

    console.log(`\n📦 Found ${firewallRules.length} Rule Groups`);

    console.log('\n--- Top 10 Rules ---');
    firewallRules.slice(0, 10).forEach((r, i) => {
        console.log(`#${i + 1} [${r.dimensions.source}] ${r.dimensions.description} (IDs: ${r.dimensions.ruleId}) - Count: ${r.count}`);
    });

    console.log('\n--- Sources Summary ---');
    // Note: firewallSources might be empty if not requested in GraphQL? Let's check logic.
    // Actually firewallSources is fetched in route.js
    if (firewallSources && firewallSources.length > 0) {
        firewallSources.forEach(s => console.log(`Source: ${s.dimensions.source}, Count: ${s.count}`));
    } else {
        console.log('No firewallSources data returned.');
    }
}

main();
