const axios = require('axios');
const { getApiToken, colors, log } = require('../helpers');

const BASE_URL = 'http://localhost:8002/api/scrape';

async function main() {
    log('🔍 Inspecting Firewall Rules...', colors.cyan);
    log('═══════════════════════════════════════');

    const apiToken = getApiToken();
    log(`✅ Token: ${apiToken.substring(0, 4)}...${apiToken.slice(-4)}`, colors.green);

    const zoneName = process.argv[2] || 'bdms.co.th';
    log(`📍 Zone: ${zoneName}`, colors.blue);

    try {
        // Fetch traffic analytics
        const response = await axios.post(BASE_URL, {
            action: 'get-traffic-analytics',
            zoneId: zoneName,
            timeRange: 1440,
            subdomain: null,
            apiToken
        });

        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to fetch data');
        }

        const data = response.data.data;
        const firewallRules = data?.firewallRules || [];
        const firewallSources = data?.firewallSources || [];

        log(`\n📊 Firewall Rules: ${firewallRules.length}`, colors.blue);
        log(`📊 Firewall Sources: ${firewallSources.length}`, colors.blue);

        // Group by source
        const sourceGroups = {};
        firewallRules.forEach(rule => {
            const source = rule.dimensions?.source || 'unknown';
            if (!sourceGroups[source]) {
                sourceGroups[source] = [];
            }
            sourceGroups[source].push(rule);
        });

        log('\n🔹 Rules by Source:', colors.cyan);
        Object.keys(sourceGroups).forEach(source => {
            log(`   ${source}: ${sourceGroups[source].length} rules`, colors.yellow);
        });

        log('\n🔹 Top 10 Rules (by count):', colors.cyan);
        const sorted = firewallRules
            .sort((a, b) => (b.count || 0) - (a.count || 0))
            .slice(0, 10);

        sorted.forEach((rule, idx) => {
            const desc = rule.dimensions?.description || 'No description';
            const source = rule.dimensions?.source || 'unknown';
            const count = rule.count || 0;
            log(`   ${idx + 1}. [${source}] ${desc}: ${count.toLocaleString()}`, colors.reset);
        });

        log('\n═══════════════════════════════════════\n');

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, colors.red);
        process.exit(1);
    }
}

main();
