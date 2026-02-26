require('dotenv').config({ path: '.env.local' });
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const axios = require('axios');
const path = require('path');

const token = process.env.CLOUDFLARE_API_TOKEN;
const dbPath = path.resolve(process.cwd(), 'db', 'gdcc_history.db');

async function fixZoneNames() {
    console.log('Connecting to database...', dbPath);
    let db;
    try {
        db = await open({ filename: dbPath, driver: sqlite3.Database });
    } catch (e) {
        console.error('Cannot open DB', e);
        return;
    }

    const rows = await db.all(`SELECT DISTINCT zone_id FROM gdcc_daily_stats`);
    console.log(`Found ${rows.length} unique zones in DB`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    let zoneNameCache = {};

    for (const row of rows) {
        const zoneId = row.zone_id;
        console.log(`Fetching name for zone ${zoneId}...`);
        try {
            const resp = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, { headers });
            if (resp.data.success) {
                const zoneName = resp.data.result.name;
                zoneNameCache[zoneId] = zoneName;
                console.log(`✅ ${zoneId} -> ${zoneName}`);
            }
        } catch (e) {
            console.error(`❌ Failed to fetch zone ${zoneId}`, e.response?.data || e.message);
        }
    }

    console.log('\nUpdating records...');
    for (const [zoneId, zoneName] of Object.entries(zoneNameCache)) {
        const records = await db.all(`SELECT id, data_json FROM gdcc_daily_stats WHERE zone_id = ?`, [zoneId]);
        for (const record of records) {
            try {
                let data = JSON.parse(record.data_json);
                if (!data.zoneName || data.zoneName !== zoneName) {
                    data.zoneName = zoneName;
                    await db.run(`UPDATE gdcc_daily_stats SET data_json = ? WHERE id = ?`, [JSON.stringify(data), record.id]);
                }
            } catch (e) {
                console.error(`Failed to update record ${record.id}`, e);
            }
        }
        console.log(`Updated all records for zone ${zoneId}`);
    }

    console.log('Done!');
}

fixZoneNames();
