// Test script for @TOP_HOST_VAL@
// This script fetches data and verifies the variable is properly populated

const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

const BASE_URL = 'http://localhost:8002/api/scrape';

// Default values matching web interface
const accountName = process.argv[2] || 'BDMS Group1';
const zoneName = process.argv[3] || 'bdms.co.th';
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

// Colors for terminal output
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

async function testTopHostVal() {
    try {
        if (!apiToken) {
            log('❌ Error: CLOUDFLARE_API_TOKEN not found in .env.local', colors.red);
            log('   Please add CLOUDFLARE_API_TOKEN=your_token to .env.local', colors.yellow);
            return;
        }

        console.log('🔍 Testing @TOP_HOST_VAL@ data...\n');

        // 1. Show Token Info
        console.log('📌 Step 1: Using API Token from .env.local...');
        log(`   Token: ${apiToken.substring(0, 4)}...${apiToken.slice(-4)}`, colors.green);
        console.log('');

        // 2. Get Zone ID from zone name
        console.log('📌 Step 2: Getting Zone ID...');
        const accountRes = await axios.post(BASE_URL, {
            action: 'get-account-info',
            apiToken
        });

        if (!accountRes.data.success) {
            throw new Error('Failed to get account info');
        }

        const accounts = accountRes.data.data;
        const targetAccount = accounts.find(a => a.name === accountName);

        if (!targetAccount) {
            log(`❌ Account "${accountName}" not found`, colors.red);
            return;
        }

        log(`   ✅ Account: ${targetAccount.name}`, colors.green);

        // Get zones for this account
        const zoneRes = await axios.post(BASE_URL, {
            action: 'list-zones',
            accountId: targetAccount.id,
            apiToken
        });

        if (!zoneRes.data.success) {
            throw new Error('Failed to list zones');
        }

        const zones = zoneRes.data.data;
        const targetZone = zones.find(z => z.name === zoneName);

        if (!targetZone) {
            log(`❌ Zone "${zoneName}" not found`, colors.red);
            return;
        }

        const zoneId = targetZone.id;
        log(`   ✅ Zone ID: ${zoneId}`, colors.green);
        console.log('');

        // 3. Call Traffic Analytics API with Zone ID
        console.log('📌 Step 3: Fetching Traffic Analytics...');
        const response = await axios.post(BASE_URL, {
            action: 'get-traffic-analytics',
            zoneId: zoneId, // Use Zone ID, not zone name!
            timeRange: 1440, // 24 hours (matching web interface)
            subdomain: null, // ALL_SUBDOMAINS
            apiToken: apiToken
        });

        if (!response.data.success) {
            log('❌ API call failed: ' + response.data.error, colors.red);
            return;
        }

        const data = response.data.data;
        log('   ✅ Data retrieved', colors.green);
        console.log('   → Available Data Fields:', Object.keys(data || {}));
        console.log('   → httpRequestsAdaptiveGroups:', data?.httpRequestsAdaptiveGroups?.length || 0);
        console.log('');

        // 4. Extract TOP_HOST_VAL data
        console.log('📌 Step 4: Processing Top Host Value...');

        const httpRequests = data?.httpRequestsAdaptiveGroups || [];
        console.log(`   → Found ${httpRequests.length} HTTP request groups`);

        // Calculate host counts
        const hostCounts = {};
        httpRequests.forEach(g => {
            const host = g.dimensions?.clientRequestHTTPHost || 'Unknown';
            hostCounts[host] = (hostCounts[host] || 0) + g.count;
        });

        // Get top hosts
        const topHosts = Object.entries(hostCounts)
            .map(([host, count]) => ({ host, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        console.log(`   → Unique hosts found: ${Object.keys(hostCounts).length}`);
        console.log(`   → Top 5 hosts:`);
        topHosts.forEach((item, idx) => {
            console.log(`      ${idx + 1}. ${item.host}: ${item.count.toLocaleString()} requests`);
        });

        // Get TOP HOST (first one)
        const topHostVal = topHosts.length > 0 ? topHosts[0].host : '-';

        console.log('\n✅ @TOP_HOST_VAL@ Result:');
        log(`   Value: "${topHostVal}"`, colors.cyan);
        console.log(`   Type: ${typeof topHostVal}`);
        console.log(`   Is Empty: ${topHostVal === '-' || !topHostVal}`);

        if (topHostVal === '-' || !topHostVal) {
            log('\n⚠️  WARNING: Variable is empty or has default value!', colors.yellow);
            console.log('   This means either:');
            console.log('   - No HTTP requests were found in the time range');
            console.log('   - Data structure has changed');
            console.log('   - API Token does not have Analytics access');
        } else {
            log('\n✅ Variable data exists and has value', colors.green);
            console.log('   → If this shows correctly but web doesn\'t display it,');
            console.log('   → The problem is in Frontend (processTemplate or reportData)');
        }

        return topHostVal;
    } catch (error) {
        log('❌ Error: ' + error.message, colors.red);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        return null;
    }
}

// Run test
console.log('═══════════════════════════════════════════════════════');
console.log('  Testing Template Variable: @TOP_HOST_VAL@');
console.log('═══════════════════════════════════════════════════════');
console.log(`  Account: ${accountName}`);
console.log(`  Zone: ${zoneName}`);
console.log('═══════════════════════════════════════════════════════\n');

testTopHostVal();
