require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const axios = require('axios');

(async () => {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    let zoneId = '9768d662cf16e1700f686f08ee2100d4';

    try {
        const res = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/api_gateway/operations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Endpoints operations:", JSON.stringify(res.data.result.slice(0, 2), null, 2));
        console.log("Total Endpoints:", res.data.result.length);
    } catch (e) {
        if (e.response) console.log(e.response.data);
        else console.error(e.message);
    }
})();
