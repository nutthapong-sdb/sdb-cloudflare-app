const axios = require('axios');
const { getApiToken, colors, log } = require('../helpers');

const BASE_URL = 'http://localhost:8002/api/scrape';
const DEFAULT_ZONE = 'bdms.co.th';

async function main() {
    log('🔍 Testing Template Variables', colors.cyan);
    log('═══════════════════════════════════════════════════════');

    const apiToken = getApiToken();
    log(`✅ Token: ${apiToken.substring(0, 4)}...${apiToken.slice(-4)}`, colors.green);

    const zoneName = process.argv[2] || DEFAULT_ZONE;
    log(`📍 Zone: ${zoneName}`, colors.blue);
    log('═══════════════════════════════════════════════════════\n');

    try {
        // Fetch traffic analytics
        log('📊 Fetching Traffic Analytics...', colors.blue);
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
        log('   ✅ Data received\n', colors.green);

        // Check key data fields
        const httpRequests = data?.httpRequestsAdaptiveGroups || [];
        const firewallSources = data?.firewallSources || [];
        const firewallRules = data?.firewallRules || [];
        const firewallIPs = data?.firewallIPs || [];

        // Calculate variables
        let totalReq = 0;
        httpRequests.forEach(item => {
            totalReq += item.count || 0;
        });

        let fwTotal = 0;
        firewallSources.forEach(item => {
            fwTotal += item.count || 0;
        });

        // Get top IP
        const ipCounts = {};
        httpRequests.forEach(g => {
            const ip = g.dimensions?.clientIP || 'Unknown';
            ipCounts[ip] = (ipCounts[ip] || 0) + g.count;
        });
        const topIPs = Object.entries(ipCounts)
            .sort((a, b) => b[1] - a[1]);
        const topIP = topIPs.length > 0 ? topIPs[0][0] : '-';

        // Get top host
        const hostCounts = {};
        httpRequests.forEach(g => {
            const host = g.dimensions?.clientRequestHTTPHost || 'Unknown';
            hostCounts[host] = (hostCounts[host] || 0) + g.count;
        });
        const topHosts = Object.entries(hostCounts)
            .sort((a, b) => b[1] - a[1]);
        const topHost = topHosts.length > 0 ? topHosts[0][0] : '-';

        // Display results
        log('📋 TEMPLATE VARIABLE DATA STATUS:', colors.cyan);
        log('───────────────────────────────────────────────────────');

        log(`\n🔢 Traffic Metrics:`, colors.blue);
        log(`   @TOTAL_REQ@ (or similar): ${totalReq.toLocaleString()}`, totalReq > 0 ? colors.green : colors.yellow);
        log(`   HTTP Request Groups: ${httpRequests.length}`, httpRequests.length > 0 ? colors.green : colors.yellow);

        log(`\n🛡️  Firewall Metrics:`, colors.blue);
        log(`   @FW_TOTAL_EVENTS@: ${fwTotal.toLocaleString()}`, fwTotal > 0 ? colors.green : colors.yellow);
        log(`   Firewall Sources: ${firewallSources.length}`, firewallSources.length > 0 ? colors.green : colors.yellow);
        log(`   Firewall Rules: ${firewallRules.length}`, firewallRules.length > 0 ? colors.green : colors.yellow);
        log(`   Firewall IPs: ${firewallIPs.length}`, firewallIPs.length > 0 ? colors.green : colors.yellow);

        log(`\n🌐 Top Values:`, colors.blue);
        log(`   @TOP_IP_VAL@: ${topIP}`, topIP !== '-' ? colors.green : colors.yellow);
        log(`   @TOP_HOST_VAL@: ${topHost}`, topHost !== '-' ? colors.green : colors.yellow);

        log('\n───────────────────────────────────────────────────────');

        // Summary
        const hasTraffic = totalReq > 0;
        const hasFirewall = fwTotal > 0;

        if (hasTraffic && hasFirewall) {
            log('\n✅ All key data fields have values', colors.green);
        } else if (hasTraffic) {
            log('\n⚠️  Traffic data OK, but firewall data is empty', colors.yellow);
        } else {
            log('\n❌ No traffic data found', colors.red);
            log('   Possible causes:', colors.yellow);
            log('   - No traffic in last 24 hours', colors.yellow);
            log('   - API Token lacks Analytics access', colors.yellow);
            log('   - Incorrect zone name', colors.yellow);
        }

        log('\n═══════════════════════════════════════════════════════\n');

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, colors.red);
        if (error.response?.data) {
            log(`   API Response: ${JSON.stringify(error.response.data)}`, colors.red);
        }
        process.exit(1);
    }
}

main();
