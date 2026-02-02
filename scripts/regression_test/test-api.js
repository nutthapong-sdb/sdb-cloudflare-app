const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// --- Configuration ---
const API_BASE_URL = 'http://localhost:8002/api/scrape';
const DB_PATH = path.join(__dirname, '../../db/sdb_users.db');

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// --- Helper Functions ---
function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function getApiTokenFromDb() {
    return new Promise((resolve, reject) => {
        log(`📂 Connecting to database at: ${DB_PATH}`, colors.blue);
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                return reject(new Error(`Could not connect to database: ${err.message}`));
            }
        });

        // Get the first user with a non-empty token
        const sql = `SELECT cloudflare_api_token FROM users WHERE cloudflare_api_token IS NOT NULL AND cloudflare_api_token != '' LIMIT 1`;

        db.get(sql, [], (err, row) => {
            db.close();
            if (err) return reject(err);
            if (row && row.cloudflare_api_token) {
                resolve(row.cloudflare_api_token);
            } else {
                reject(new Error('No API Token found in database (users table). Please login via UI and save an API Key first.'));
            }
        });
    });
}

async function runTest(testName, testFn) {
    process.stdout.write(`Testing ${testName}... `);
    try {
        await testFn();
        console.log(`${colors.green}PASS${colors.reset}`);
        return true;
    } catch (error) {
        console.log(`${colors.red}FAIL${colors.reset}`);
        log(`  Error: ${error.message}`, colors.red);
        if (error.response?.data) {
            log(`  API Response: ${JSON.stringify(error.response.data, null, 2)}`, colors.red);
        } else if (error.response) {
            log(`  API Status: ${error.response.status} ${error.response.statusText}`, colors.red);
        }
        return false;
    }
}

// --- Tests ---

async function main() {
    log('🚀 Starting API Regression Tests (System User Mode)...', colors.cyan);
    log('-----------------------------------');

    let apiToken;
    try {
        apiToken = await getApiTokenFromDb();
        log('✅ Retrieved API Token from Database.', colors.green);
        // Mask token for display
        const masked = apiToken.substring(0, 4) + '...' + apiToken.substring(apiToken.length - 4);
        log(`   Token: ${masked}`);
    } catch (error) {
        log(`❌ Failed to get API Token: ${error.message}`, colors.red);
        process.exit(1);
    }

    const headers = {
        'Content-Type': 'application/json'
    };

    // Helper payload to inject token
    const withToken = (data) => ({ ...data, apiToken });

    // 1. Verify Connectivity & Token (via App API)
    // We implicitly verify when we make the first request.

    // 2. SDB: List Zones (Get Accounts first)
    let zoneId = null;
    let accountId = null;

    log('\n--- SDB System Tests ---', colors.blue);

    await runTest('Get Account Info', async () => {
        const response = await axios.post(API_BASE_URL, withToken({ action: 'get-account-info' }), { headers });
        if (!response.data.success) throw new Error(response.data.message || 'Failed to get account info');
        if (!response.data.data || response.data.data.length === 0) throw new Error('No accounts found');
        accountId = response.data.data[0].id; // Pick first account
    });

    if (accountId) {
        await runTest(`List Zones (Account: ${accountId})`, async () => {
            const response = await axios.post(API_BASE_URL, withToken({ action: 'list-zones', accountId }), { headers });
            if (!response.data.success) throw new Error(response.data.message || 'Failed to list zones');
            if (response.data.data && response.data.data.length > 0) {
                zoneId = response.data.data[0].id; // Pick first zone
            } else {
                log('  (No zones found, skipping valid zone tests)', colors.yellow);
            }
        });
    }

    if (zoneId) {
        // 3. SDB: API Discovery
        await runTest(`Get API Discovery (Zone: ${zoneId})`, async () => {
            const response = await axios.post(API_BASE_URL, withToken({ action: 'get-api-discovery', zoneId }), { headers });
            if (!response.data.success) throw new Error(response.data.message || 'Failed to fetch API Discovery');

            const data = response.data.data;
            if (Array.isArray(data) && data.length > 0) {
                const firstItem = data[0];
                if (!firstItem.method) throw new Error('Missing "method" field');
                if (!firstItem.source) throw new Error('Missing "source" field');
            }
        });

        log('\n--- GDCC System Tests ---', colors.blue);

        // 4. GDCC: Zone Settings
        await runTest(`Get Zone Settings (Zone: ${zoneId})`, async () => {
            const response = await axios.post(API_BASE_URL, withToken({ action: 'get-zone-settings', zoneId }), { headers });
            if (!response.data.success) throw new Error(response.data.message || 'Failed to fetch Zone Settings');

            const settings = response.data.data;
            if (!settings.wafManagedRules) throw new Error('Missing wafManagedRules');

            const aiBots = settings.botManagement?.blockAiBots;
            if (aiBots) {
                // log(`    Confirmed blockAiBots value: "${aiBots}"`);
                if (aiBots === 'unknown') throw new Error('blockAiBots is unknown');
            } else {
                throw new Error('Missing blockAiBots in response');
            }

            log('\n🔍 [USER DATA CHECK] Raw Zone Settings Data:');
            log(JSON.stringify(settings, null, 2));
            log('-------------------------------------------');
        });

        // 4.1 GDCC: DNS Records
        await runTest(`Get DNS Records (Zone: ${zoneId})`, async () => {
            const response = await axios.post(API_BASE_URL, withToken({ action: 'get-dns-records', zoneId }), { headers });
            if (!response.data.success) throw new Error(response.data.message || 'Failed to fetch DNS Records');

            const dnsData = response.data.data;
            log('\n🔍 [USER DATA CHECK] Raw DNS Records Data:');
            log(JSON.stringify(dnsData, null, 2));
            log('-------------------------------------------');
        });

        // 5. GDCC: Traffic Analytics
        await runTest(`Get Traffic Analytics (Zone: ${zoneId})`, async () => {
            // Use 24h (1440 mins)
            const response = await axios.post(API_BASE_URL, withToken({
                action: 'get-traffic-analytics',
                zoneId,
                timeRange: 1440
            }), { headers });

            if (!response.data.success) throw new Error(response.data.message || 'Failed to fetch Traffic Analytics');
            const data = response.data.data;
            if (!Array.isArray(data)) throw new Error('Data should be an array');
        });

    } else {
        log('⚠️ Skipping Zone-dependent tests because no Zone ID was found.', colors.yellow);
    }

    log('\n-----------------------------------');
    log('✅ Regression Tests Completed', colors.cyan);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
