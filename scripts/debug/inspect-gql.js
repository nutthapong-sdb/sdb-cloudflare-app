const axios = require('axios');

async function discoverFields() {
    const token = 'PfSMg9D7TtTRKgti63sdSmgHTGxsMgPgLYGFS0u8';

    // Introspection query for httpRequests1dGroups sum fields
    const query = `
    {
      __type(name: "ZoneHttpRequests1dGroupsSum") {
        fields {
          name
        }
      }
    }
    `;

    try {
        const response = await axios({
            method: 'POST',
            url: 'https://api.cloudflare.com/client/v4/graphql',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            data: { query }
        });

        console.log('Fields:', JSON.stringify(response.data.data?.__type?.fields?.map(f => f.name), null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

discoverFields();
