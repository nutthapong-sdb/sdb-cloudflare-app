// Test script for @IP_ACCESS_RULES_ROWS@
const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

const BASE_URL = 'http://localhost:8002/api/scrape';
const accountName = process.argv[2] || 'BDMS Group1';
const zoneName = process.argv[3] || 'bdms.co.th';
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

async function getZoneId(name) {
    try {
        const response = await axios.post(BASE_URL, {
            action: 'list-zones',
            accountId: null, // Fetch all to find match
            apiToken: apiToken
        });

        if (response.data.success) {
            const zones = response.data.data;
            const zone = zones.find(z => z.name === name);

            if (!zone) {
                // Show available zones for debugging
                log('\n⚠️  Available zones:', colors.yellow);
                zones.slice(0, 10).forEach(z => {
                    console.log(`   - ${z.name} (${z.id})`);
                });
                if (zones.length > 10) {
                    console.log(`   ... and ${zones.length - 10} more zones`);
                }
            }

            return zone ? zone.id : null;
        }
        return null;
    } catch (e) {
        console.error("Failed to list zones:", e.message);
        return null;
    }
}

async function testVariable() {
    try {
        if (!apiToken) {
            log('❌ Error: CLOUDFLARE_API_TOKEN not found in .env.local', colors.red);
            return;
        }

        console.log(`🔍 Testing @IP_ACCESS_RULES_ROWS@ for zone: ${zoneName}...\n`);

        // 1. Get Zone ID
        const zoneId = await getZoneId(zoneName);
        if (!zoneId) {
            log(`❌ Error: Zone ID not found for ${zoneName}`, colors.red);
            return;
        }
        log(`   Zone ID: ${zoneId}`, colors.green);

        // 2. Call API (get-zone-settings)
        const response = await axios.post(BASE_URL, {
            action: 'get-zone-settings',
            zoneId: zoneId,
            apiToken: apiToken
        });

        if (!response.data.success) {
            log('❌ API Error: ' + response.data.error, colors.red);
            return;
        }

        const data = response.data.data;

        // 3. Extract IP Access Rules
        const ipAccessRules = data.ipAccessRules || [];

        console.log('\n✅ Result:');
        log(`   Total IP Access Rules: ${ipAccessRules.length}`, colors.cyan);

        if (ipAccessRules.length > 0) {
            console.log(JSON.stringify(ipAccessRules, null, 2));
            log('\n✅ Variable has value', colors.green);
        } else {
            log('\n⚠️  WARNING: Variable is empty!', colors.yellow);
        }

        return ipAccessRules;
    } catch (error) {
        log('❌ Error: ' + error.message, colors.red);
        if (error.response) {
            console.log(error.response.data);
        }
        return null;
    }
}

testVariable();
