const axios = require('axios');
const helpers = require('../helpers');
const { log, colors, getApiToken } = helpers;

const BASE_URL = 'https://api.cloudflare.com/client/v4/graphql';
const API_TOKEN = getApiToken();

async function testField(fieldName) {
    log(`Testing field: ${fieldName}...`, colors.yellow);

    // Hardcoded for 'scg.com' based on previous successful run
    const ZONE_ID = '19647477578f706f508ffa416d8e06e9';
    const NOW = new Date();
    const AGO = new Date(NOW.getTime() - 60 * 60 * 1000); // 1 Hour

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
            log(`❌ Field '${fieldName}' FAILED: ${response.data.errors[0].message}`, colors.red);
            return false;
        } else {
            const data = response.data.data.viewer.zones[0].firewallEventsAdaptive;
            log(`✅ Field '${fieldName}' SUCCESS! Value: ${JSON.stringify(data[0])}`, colors.green);
            return true;
        }

    } catch (e) {
        log(`❌ Error: ${e.message}`, colors.red);
        if (e.response) console.log(e.response.data);
        return false;
    }
}

async function run() {
    // Try potential method field names
    await testField('clientRequestHTTPMethod'); // Original (Failed?)
    await testField('clientRequestHTTPMethodName'); // Potential
    await testField('method'); // Potential legacy
    await testField('httpMethod'); // Potential
}

run();
