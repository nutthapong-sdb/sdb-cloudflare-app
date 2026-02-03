const axios = require('axios');
const { getApiToken, colors, log } = require('../helpers');

const BASE_URL = 'http://localhost:8002/api/scrape';
const DEFAULT_ACCOUNT = 'BDMS Group1';
const DEFAULT_ZONE = 'bdms.co.th';

async function main() {
    try {
        log('🔍 Testing Total Requests Calculation', colors.cyan);
        log('═══════════════════════════════════════', colors.cyan);

        const apiToken = getApiToken();
        log(`✅ Token: ${apiToken.substring(0, 4)}...${apiToken.slice(-4)}`, colors.green);

        const zoneName = process.argv[2] || DEFAULT_ZONE;
        log(`📍 Zone: ${zoneName}`, colors.blue);

        // Fetch traffic analytics
        log('\n📊 Fetching Traffic Analytics (24h)...', colors.blue);
        const response = await axios.post(BASE_URL, {
            action: 'get-traffic-analytics',
            zoneId: zoneName,
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
