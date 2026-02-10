const axios = require('axios');
const { getApiToken, colors, log } = require('../libs/api-helper');

const BASE_URL = 'http://localhost:8002/api/scrape';
const DEFAULT_ACCOUNT = 'BDMS Group1';
const DEFAULT_ZONE = 'bdms.co.th';

async function main() {
    try {
        log('🔍 Testing Total Requests Calculation', colors.cyan);
        log('═══════════════════════════════════════', colors.cyan);

        const apiToken = getApiToken();
        log(`✅ Token: ${apiToken.substring(0, 4)}...${apiToken.slice(-4)}`, colors.green);

        const zoneName = process.argv[3] || DEFAULT_ZONE;
        const accountName = process.argv[2] || DEFAULT_ACCOUNT;

        log(`📍 Target: ${accountName} > ${zoneName}`, colors.blue);

        // 1. Get Account & Zone ID first (Cloudflare Analytics requires UUID, not domain name)
        log('\n1️⃣ Finding Zone ID...', colors.blue);

        // Get Account Info
        const accountRes = await axios.post(BASE_URL, {
            action: 'get-account-info',
            apiToken
        });

        if (!accountRes.data.success) throw new Error('Failed to fetch account info');

        const account = accountRes.data.data.find(a => a.name === accountName);
        if (!account) throw new Error(`Account '${accountName}' not found`);

        // Get Zones
        const zoneRes = await axios.post(BASE_URL, {
            action: 'list-zones',
            accountId: account.id,
            apiToken
        });

        if (!zoneRes.data.success) throw new Error('Failed to list zones');

        const zone = zoneRes.data.data.find(z => z.name === zoneName);
        if (!zone) throw new Error(`Zone '${zoneName}' not found`);

        const zoneId = zone.id;
        log(`   ✅ Found Zone ID: ${zoneId}`, colors.green);

        // 2. Fetch traffic analytics
        log('\n2️⃣ Fetching Traffic Analytics (24h)...', colors.blue);
        const response = await axios.post(BASE_URL, {
            action: 'get-traffic-analytics',
            zoneId: zoneId, // Use the fetched UUID
            timeRange: 1440,
            subdomain: null,
            apiToken
        });

        if (!response.data.success) {
            throw new Error(response.data.error || 'API call failed');
        }

        const data = response.data.data;
        const httpRequests = data?.httpRequestsAdaptiveGroups || [];

        log(`   → HTTP Request Groups: ${httpRequests.length}`, colors.cyan);

        // Calculate total requests
        let totalRequests = 0;
        httpRequests.forEach(item => {
            totalRequests += item.count || 0;
        });

        log('\n✅ Results:', colors.green);
        log(`   Total Requests: ${totalRequests.toLocaleString()}`, colors.cyan);

        if (totalRequests === 0) {
            log('\n⚠️  WARNING: Total requests is 0', colors.yellow);
            log('   This could mean:', colors.yellow);
            log('   - No traffic in the last 24 hours', colors.yellow);
            log('   - API Token lacks Analytics access', colors.yellow);
            log('   - Zone name incorrect', colors.yellow);
        } else {
            log(`\n🎉 Success! Found ${totalRequests.toLocaleString()} requests`, colors.green);
        }

        log('\n═══════════════════════════════════════\n', colors.cyan);

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, colors.red);
        if (error.response?.data) {
            log(`   API Response: ${JSON.stringify(error.response.data)}`, colors.red);
        }
        process.exit(1);
    }
}

main();
