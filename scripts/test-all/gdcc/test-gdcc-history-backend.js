import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BASE_URL = 'http://localhost:8002';

async function testGDCCHistoryBackend() {
    console.log('🧪 Starting GDCC History Backend Test...');

    if (!CLOUDFLARE_API_TOKEN) {
        console.error('❌ CLOUDFLARE_API_TOKEN is not set in .env.local');
        process.exit(1);
    }

    try {
        // Step 1: List zones to get a valid Zone ID
        const listRes = await axios.post(`${BASE_URL}/api/scrape`, {
            action: 'list-zones',
            apiToken: CLOUDFLARE_API_TOKEN
        });

        if (!listRes.data.success || !listRes.data.data.length) {
            console.error('❌ Failed to fetch zones');
            process.exit(1);
        }

        const testZoneId = listRes.data.data[0].id;
        console.log(`✅ Fetched test zone: ${testZoneId}`);

        // Step 2: Test get-sync-status
        console.log(`🔄 Testing get-sync-status...`);
        const statusRes = await axios.post(`${BASE_URL}/api/scrape`, {
            action: 'get-sync-status',
            zoneId: testZoneId,
            apiToken: CLOUDFLARE_API_TOKEN
        });

        if (statusRes.data.success) {
            console.log(`✅ get-sync-status success. Last Sync: ${statusRes.data.data.lastSync || 'Never'}`);
        } else {
            console.error('❌ get-sync-status failed:', statusRes.data.message);
            process.exit(1);
        }

        console.log('\n🎉 All GDCC History Backend Tests Passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

testGDCCHistoryBackend();
