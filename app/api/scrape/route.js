import { NextResponse } from 'next/server';
import axios from 'axios';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

// ฟังก์ชันเรียก Cloudflare API
async function callCloudflareAPI(endpoint, method = 'GET', data = null) {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!apiToken || apiToken === 'your-cloudflare-api-token-here') {
        throw new Error('กรุณาตั้งค่า CLOUDFLARE_API_TOKEN ใน .env.local');
    }

    const config = {
        method,
        url: `${CLOUDFLARE_API_BASE}${endpoint}`,
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
    };

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error('Cloudflare API Error:', error.response?.data || error.message);
        throw error;
    }
}

export async function POST(request) {
    try {
        // อ่าน body ครั้งเดียว
        const body = await request.json();
        const { action, zoneId, recordType, accountId } = body;

        if (action === 'test') {
            // ทดสอบการเชื่อมต่อ
            console.log('🔐 กำลังทดสอบ Cloudflare API Token...');

            const result = await callCloudflareAPI('/user/tokens/verify');

            if (result.success) {
                console.log('✅ API Token ใช้งานได้!');
                console.log('   Status:', result.result.status);

                return NextResponse.json({
                    success: true,
                    message: 'เชื่อมต่อ Cloudflare API สำเร็จ!',
                    data: result.result
                });
            }

        } else if (action === 'list-zones') {
            // ดึงรายชื่อ Zones (Domains) ทั้งหมด หรือ filter ตาม account
            console.log('📋 กำลังดึงรายชื่อ Zones...');

            let endpoint = '/zones';
            if (accountId) {
                endpoint += `?account.id=${accountId}`;
                console.log(`   🎯 Filter ตาม Account ID: ${accountId}`);
            }

            const result = await callCloudflareAPI(endpoint);

            if (result.success) {
                const zones = result.result.map(zone => ({
                    id: zone.id,
                    name: zone.name,
                    status: zone.status,
                    plan: zone.plan.name,
                    nameServers: zone.name_servers
                }));

                console.log(`✅ พบ ${zones.length} zones`);

                return NextResponse.json({
                    success: true,
                    message: `พบ ${zones.length} zones`,
                    data: zones
                });
            }

        } else if (action === 'get-dns-records') {
            // ดึง DNS Records ของ Zone
            if (!zoneId) {
                return NextResponse.json({
                    success: false,
                    message: 'กรุณาระบุ zoneId'
                }, { status: 400 });
            }

            console.log(`📝 กำลังดึง DNS Records ของ Zone: ${zoneId}...`);

            let endpoint = `/zones/${zoneId}/dns_records`;
            if (recordType) {
                endpoint += `?type=${recordType}`;
            }

            const result = await callCloudflareAPI(endpoint);

            if (result.success) {
                const records = result.result.map(record => ({
                    id: record.id,
                    type: record.type,
                    name: record.name,
                    content: record.content,
                    proxied: record.proxied,
                    ttl: record.ttl
                }));

                console.log(`✅ พบ ${records.length} DNS records`);

                return NextResponse.json({
                    success: true,
                    message: `พบ ${records.length} DNS records`,
                    data: records
                });
            }

        } else if (action === 'get-account-info') {
            // ดึงข้อมูล Account
            console.log('👤 กำลังดึงข้อมูล Account...');

            const result = await callCloudflareAPI('/accounts');

            if (result.success) {
                const accounts = result.result.map(account => ({
                    id: account.id,
                    name: account.name,
                    type: account.type,
                    settings: account.settings
                }));

                console.log(`✅ พบ ${accounts.length} accounts`);

                return NextResponse.json({
                    success: true,
                    message: `พบ ${accounts.length} accounts`,
                    data: accounts
                });
            }

        } else {
            return NextResponse.json({
                success: false,
                message: 'Invalid action. รองรับ: test, list-zones, get-dns-records, get-account-info'
            }, { status: 400 });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);

        return NextResponse.json({
            success: false,
            message: error.message || 'เกิดข้อผิดพลาด',
            error: error.response?.data || error.toString()
        }, { status: 500 });
    }
}

// GET method สำหรับทดสอบ
export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Cloudflare API Scraper is running',
        actions: [
            'test - ทดสอบ API Token',
            'list-zones - ดึงรายชื่อ Domains ทั้งหมด',
            'get-dns-records - ดึง DNS Records (ต้องระบุ zoneId)',
            'get-account-info - ดึงข้อมูล Account'
        ]
    });
}
