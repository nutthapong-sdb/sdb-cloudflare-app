const axios = require('axios');

async function testGQL() {
    const token = 'PfSMg9D7TtTRKgti63sdSmgHTGxsMgPgLYGFS0u8';
    const zoneId = '93d69480316a824799294bd1716ff1d8';

    const now = new Date();
    const since = new Date(now.getTime() - 1440 * 60 * 1000);

    // Test 1: totalRequestsSummary
    const query = `
    query GetZoneAnalytics($zoneTag: String, $since_date: String, $until_date: String) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          totalRequestsSummary: httpRequests1dGroups(
            limit: 1000
            filter: {
              date_geq: $since_date, date_leq: $until_date
            }
          ) {
            sum {
              requests
              edgeResponseBytes
            }
          }
        }
      }
    }
    `;

    const variables = {
        zoneTag: zoneId,
        since_date: since.toISOString().split('T')[0],
        until_date: now.toISOString().split('T')[0],
    };

    console.log('Variables:', variables);

    try {
        const response = await axios({
            method: 'POST',
            url: 'https://api.cloudflare.com/client/v4/graphql',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            data: { query, variables }
        });

        console.log('Result:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error('Error:', JSON.stringify(e.response?.data || e.message, null, 2));
    }
}

testGQL();
