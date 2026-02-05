require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const helpers = require('../helpers');
const { log, colors } = helpers;

const BASE_URL = 'https://api.cloudflare.com/client/v4/graphql';
const API_TOKEN = process.env.CLOUDFLARE_FIREWALL_API_TOKEN;

async function testField(fieldName) {
    log(`Testing field: ${fieldName}...`, colors.yellow);

    // Hardcoded for 'scg.com' (This zone likely has Ent/Biz plan)
    const ZONE_ID = '19647477578f706f508ffa416d8e06e9';
    const NOW = new Date();
    const AGO = new Date(NOW.getTime() - 60 * 60 * 1000 * 24); // 24 Hours

    const query = `
        query TestField($zoneTag: String, $since: String, $until: String) {
            viewer {
                zones(filter: { zoneTag: $zoneTag }) {
                    firewallEventsAdaptive(
                        filter: {
                            datetime_geq: $since,
                            datetime_leq: $until
                        }
                        limit: 1
                    ) {
                        ${fieldName}
                    }
                }
            }
        }
    `;

    try {
        const response = await axios.post(BASE_URL, {
            query,
            variables: {
                zoneTag: ZONE_ID,
                since: AGO.toISOString(),
                until: NOW.toISOString()
            }
        }, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.errors) {
            // Check for specific error types
            const msg = response.data.errors[0].message;
            if (msg.includes('unknown field')) {
                log(`❌ Field '${fieldName}' FAILED: Unknown Field`, colors.red);
            } else if (msg.includes('does not have access')) {
                log(`❌ Field '${fieldName}' FAILED: No Access (Plan limitation)`, colors.red);
            } else {
                log(`❌ Field '${fieldName}' FAILED: ${msg}`, colors.red);
            }
            return false;
        } else {
            const data = response.data.data.viewer.zones[0].firewallEventsAdaptive;
            if (data && data.length > 0) {
                log(`✅ Field '${fieldName}' SUCCESS! Value: ${JSON.stringify(data[0])}`, colors.green);
            } else {
                log(`✅ Field '${fieldName}' SUCCESS (No query errors, but no data returned)`, colors.cyan);
            }
            return true;
        }

    } catch (e) {
        log(`❌ Error: ${e.message}`, colors.red);
        if (e.response) console.log(e.response.data);
        return false;
    }
}

async function run() {
    if (!API_TOKEN) {
        log('❌ No CLOUDFLARE_FIREWALL_API_TOKEN found.', colors.red);
        return;
    }

    // List of fields to test
    const fields = [
        // WAF Scores (Detailed)
        'wafSqlInjectionAttackScore', // Original (Failed)
        'wafSqliAttackScore', // Candidate 1
        'wafXssAttackScore',
        'wafRceAttackScore',

        // Bot Scores (Detailed)
        'botScore',
        'botScoreSrcName',

        // Fingerprints
        'ja3Hash',
        'ja4'
    ];

    for (const field of fields) {
        await testField(field);
    }
}

run();
