require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const axios = require('axios');

(async () => {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    let zoneId = '415f33dc8924b17aa1ef5b8f62f83731';

    const zres = await axios.get('https://api.cloudflare.com/client/v4/zones?per_page=1', {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (zres.data.result.length > 0) zoneId = zres.data.result[0].id;

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
