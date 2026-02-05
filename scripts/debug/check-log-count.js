
const axios = require('axios');
const { colors, log } = require('../helpers');

const logger = {
    info: (msg) => log(`ℹ️  ${msg}`, colors.cyan),
    success: (msg) => log(`✅ ${msg}`, colors.green),
    warn: (msg) => log(`⚠️  ${msg}`, colors.yellow),
    error: (msg) => log(`❌ ${msg}`, colors.red),
};

async function checkLogCount() {
    const apiToken = process.env.CLOUDFLARE_FIREWALL_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    if (!apiToken) {
        logger.error('No API Token found in .env.local');
        return;
    }

    // 1. Get Zone ID for scg.com
    let zoneId = '';
    try {
        const zoneRes = await axios.get('https://api.cloudflare.com/client/v4/zones?name=scg.com', {
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        if (zoneRes.data.result && zoneRes.data.result.length > 0) {
            zoneId = zoneRes.data.result[0].id;
            logger.info(`Found Zone ID for scg.com: ${zoneId}`);
        } else {
            logger.error('Zone scg.com not found');
            return;
        }
    } catch (error) {
        logger.error(`Failed to get Zone ID: ${error.message}`);
        return;
    }

    // 2. Fetch Logs (Limit 10,000)
    logger.info('Fetching Firewall Logs for last 24 hours (Limit: 10,000)...');

    const minutes = 1440; // 24 Hours
    const now = new Date();
    const since = new Date(now.getTime() - minutes * 60 * 1000);

    const query = `
        query GetFirewallEvents($zoneTag: String, $since: String, $until: String, $limit: Int) {
            viewer {
                zones(filter: { zoneTag: $zoneTag }) {
                    firewallEventsAdaptive(
                        filter: {
                            datetime_geq: $since,
                            datetime_leq: $until
                        }
                        limit: $limit
                        orderBy: [datetime_DESC]
                    ) {
                        datetime
                    }
                }
            }
        }
    `;

    const variables = {
        zoneTag: zoneId,
        since: since.toISOString(),
        until: now.toISOString(),
        limit: 10000
    };

    try {
        const response = await axios({
            method: 'POST',
            url: 'https://api.cloudflare.com/client/v4/graphql',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            data: { query, variables }
        });

        if (response.data.errors) {
            logger.error('GraphQL Errors:', response.data.errors);
            return;
        }

        const logs = response.data.data.viewer.zones[0].firewallEventsAdaptive || [];
        logger.success(`✅ Total Logs Found in last 24h: ${logs.length}`);

        if (logs.length >= 10000) {
            logger.warn('⚠️ Logs Hit the Hard Limit of 10,000! There might be more logs than fetched.');
        } else {
            logger.info('Fetched all logs within the 24h period (Count is accurate).');
        }

    } catch (error) {
        logger.error(`API Error: ${error.message}`);
        if (error.response) {
            console.error(error.response.data);
        }
    }
}

checkLogCount();
