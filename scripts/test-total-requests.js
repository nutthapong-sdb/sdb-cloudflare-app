const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Configuration ---
const BASE_URL = 'http://localhost:8002/api/scrape';
const DB_PATH = path.join(__dirname, '../db/sdb_users.db');

// --- User Inputs ---
const TARGET_ACCOUNT = process.argv[2] || 'BDMS Group1';
const TARGET_ZONE = process.argv[3] || 'bdms.co.th';
const TARGET_HOST = process.argv[4] || ''; // Optional: specify host
const TARGET_MINUTES = process.argv[5] ? parseInt(process.argv[5]) : 43200; // Default 30 days (43200 min)

// --- Colors ---
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

async function getApiTokenFromDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
        });

        db.get("SELECT cloudflare_api_token FROM users WHERE cloudflare_api_token IS NOT NULL LIMIT 1", (err, row) => {
            if (err) reject(err);
            else if (row) resolve(row.cloudflare_api_token);
            else reject(new Error('No user found in database'));
            db.close();
        });
    });
}

async function main() {
    try {
        const days = Math.round(TARGET_MINUTES / 1440);
        log(`🚀 Starting Total Requests Check for: [${TARGET_ACCOUNT}] -> [${TARGET_ZONE}] ${TARGET_HOST ? '(' + TARGET_HOST + ')' : '(ALL)'}`, colors.cyan);
        log(`📅 Time Range: ${days} days (${TARGET_MINUTES} minutes)`, colors.cyan);

        // 1. Get Token
        log('1. Fetching System Token...', colors.blue);
        const token = await getApiTokenFromDb();
        log(`   Token found: ${token.substring(0, 4)}...${token.slice(-4)}`, colors.green);

        // 2. Find Account ID
        log(`2. Finding Account ID for "${TARGET_ACCOUNT}"...`, colors.blue);
        const accountRes = await axios.post(BASE_URL, { action: 'get-account-info', apiToken: token });
        if (!accountRes.data.success) throw new Error('Failed to fetch accounts: ' + accountRes.data.message);

        const targetAccount = accountRes.data.data.find(a => a.name === TARGET_ACCOUNT);
        if (!targetAccount) throw new Error(`Account "${TARGET_ACCOUNT}" not found!`);
        const accountId = targetAccount.id;
        log(`   ✅ Found Account ID: ${accountId}`, colors.green);

        // 3. Find Zone ID
        log(`3. Finding Zone ID for "${TARGET_ZONE}"...`, colors.blue);
        const zoneRes = await axios.post(BASE_URL, { action: 'list-zones', accountId: accountId, apiToken: token });
        if (!zoneRes.data.success) throw new Error('Failed to fetch zones: ' + zoneRes.data.message);

        const targetZone = zoneRes.data.data.find(z => z.name === TARGET_ZONE);
        if (!targetZone) throw new Error(`Zone "${TARGET_ZONE}" not found!`);
        const zoneId = targetZone.id;
        log(`   ✅ Found Zone ID: ${zoneId}`, colors.green);

        // 4. Get Traffic Analytics
        log(`4. Fetching Traffic Analytics (Total Requests)...`, colors.blue);
        const analyticsRes = await axios.post(BASE_URL, {
            action: 'get-traffic-analytics',
            zoneId: zoneId,
            apiToken: token,
            subdomain: TARGET_HOST, // Specific domain/host
            timeRange: TARGET_MINUTES
        });

        if (!analyticsRes.data.success) {
            log(`❌ Failed to fetch Analytics: ${analyticsRes.data.message}`, colors.red);
            return;
        }

        const analytics = analyticsRes.data.data;
        log(`Debug Analytics Data: ${JSON.stringify(analytics, null, 2)}`); // View if needed

        const body = analyticsRes.data;
        const httpGroups = body.data || [];
        const summary = body.totalRequestsSummary || [];

        let totalRequests = 0;
        let dataSource = 'Adaptive Logs';

        if (summary.length > 0) {
            dataSource = '1h/1d Analytics';
            summary.forEach(day => {
                totalRequests += (day.sum ? day.sum.requests : 0);
            });
        } else {
            httpGroups.forEach(group => {
                totalRequests += group.count;
            });
        }

        log(`   📊 Data Source: ${dataSource}`, colors.cyan);
        log(`   🔎 Found ${httpGroups.length} Adaptive groups and ${summary.length} Summary groups.`, colors.cyan);



        log(`\n✅ Result for ${TARGET_HOST || TARGET_ZONE}:`, colors.green);
        log(`   - Total Requests (Last ${days} days): ${totalRequests.toLocaleString()}`, colors.green);
        log('============================================================\n', colors.green);

    } catch (error) {
        log(`❌ Error: ${error.message}`, colors.red);
    }
}

main();
