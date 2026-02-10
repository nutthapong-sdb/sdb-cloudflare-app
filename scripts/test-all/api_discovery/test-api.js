const axios = require('axios');
const { getApiToken, colors, log } = require('../helpers');

// --- Configuration ---
const API_BASE_URL = 'http://localhost:8002/api/scrape';

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
    log('🚀 Starting API Regression Tests...', colors.cyan);
    log('-----------------------------------');

    // Get API Token from .env.local
    const apiToken = getApiToken();
    log('✅ Using API Token from .env.local', colors.green);
    const masked = apiToken.substring(0, 4) + '...' + apiToken.substring(apiToken.length - 4);
    log(`   Token: ${masked}`);

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
            if (typeof data !== 'object') throw new Error('Data should be an object');
            if (!Array.isArray(data.httpRequestsAdaptiveGroups)) throw new Error('Missing httpRequestsAdaptiveGroups array');
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
