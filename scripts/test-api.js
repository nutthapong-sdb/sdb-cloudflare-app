const fs = require('fs');
const path = require('path');
const axios = require('axios');

// --- Configuration ---
const API_BASE_URL = 'http://localhost:8002/api/scrape'; // Adjust if running on a different port
const LOCAL_ENV_PATH = path.join(__dirname, '../.env.local');

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

function loadEnv() {
    if (fs.existsSync(LOCAL_ENV_PATH)) {
        const envConfig = fs.readFileSync(LOCAL_ENV_PATH, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
        log('✅ Loaded .env.local configuration', colors.green);
    } else {
        log('⚠️  .env.local not found. Relying on existing environment variables.', colors.yellow);
    }
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
        }
        return false;
    }
}

// --- Tests ---

async function main() {
    log('🚀 Starting Regression Tests...', colors.cyan);
    log('-----------------------------------');

    loadEnv();

    if (!process.env.CLOUDFLARE_API_TOKEN) {
        log('❌ CLOUDFLARE_API_TOKEN is missing. Please set it in .env.local or environment.', colors.red);
        process.exit(1);
    }

    const headers = {
        'Content-Type': 'application/json'
    };

    // 1. Verify Connectivity & Token (Internal Check)
    // We'll trust the script's ability to run means Node is okay.
    // We will verify the token by making a raw call to Cloudflare verify URL to sure.
    await runTest('Cloudflare Token Validity', async () => {
        const response = await axios.get('https://api.cloudflare.com/client/v4/user/tokens/verify', {
            headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` }
        });
        if (response.data.success !== true) throw new Error('Token verification failed');
    });

    // 2. SDB: List Zones
    let zoneId = null;
    let accountId = null;

    log('\n--- SDB System Tests ---', colors.blue);

    // We need an account ID first usually, but the list-zones endpoint in our app requires accountId
    // Let's first get accounts
    await runTest('Get Account Info', async () => {
        const response = await axios.post(API_BASE_URL, { action: 'get-account-info' }, { headers });
        if (!response.data.success) throw new Error('Failed to get account info');
        if (!response.data.data || response.data.data.length === 0) throw new Error('No accounts found');
        accountId = response.data.data[0].id;
    });

    if (accountId) {
        await runTest(`List Zones (Account: ${accountId})`, async () => {
            const response = await axios.post(API_BASE_URL, { action: 'list-zones', accountId }, { headers });
            if (!response.data.success) throw new Error('Failed to list zones');
            if (response.data.data && response.data.data.length > 0) {
                zoneId = response.data.data[0].id; // Pick first zone for next tests
            } else {
                log('  (No zones found, skipping valid zone tests)', colors.yellow);
            }
        });
    }

    if (zoneId) {
        // 3. SDB: API Discovery
        await runTest(`Get API Discovery (Zone: ${zoneId})`, async () => {
            const response = await axios.post(API_BASE_URL, { action: 'get-api-discovery', zoneId }, { headers });
            if (!response.data.success) throw new Error('Failed to fetch API Discovery');

            const data = response.data.data;
            if (Array.isArray(data) && data.length > 0) {
                // Check for Method and Source fields specifically
                const firstItem = data[0];
                if (!firstItem.method) throw new Error('Missing "method" field in response');
                if (!firstItem.source) throw new Error('Missing "source" field in response');
            } else {
                log('  (No discovery data found, but API call succeeded)', colors.yellow);
            }
        });

        log('\n--- GDCC System Tests ---', colors.blue);

        // 4. GDCC: Zone Settings
        await runTest(`Get Zone Settings (Zone: ${zoneId})`, async () => {
            const response = await axios.post(API_BASE_URL, { action: 'get-zone-settings', zoneId }, { headers });
            if (!response.data.success) throw new Error('Failed to fetch Zone Settings');

            const settings = response.data.data;
            // Note: securityLevel was removed from the app
            if (!settings.wafManagedRules) throw new Error('Missing wafManagedRules');

            // Verify Block AI Bots Fix
            const aiBots = settings.botManagement?.blockAiBots;
            if (aiBots) {
                log(`    Confirmed blockAiBots value: "${aiBots}"`, colors.green);
                if (aiBots === 'unknown') throw new Error('blockAiBots is still unknown!');
            } else {
                throw new Error('Missing blockAiBots in response');
            }
        });

        // 5. GDCC: Traffic Analytics
        await runTest(`Get Traffic Analytics (Zone: ${zoneId})`, async () => {
            const response = await axios.post(API_BASE_URL, {
                action: 'get-traffic-analytics',
                zoneId,
                timeRange: 1440 // 24h
            }, { headers });

            if (!response.data.success) throw new Error('Failed to fetch Traffic Analytics');
            const data = response.data.data;
            // Basic structure check
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
});
