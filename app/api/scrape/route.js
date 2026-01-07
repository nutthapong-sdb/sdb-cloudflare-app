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

        } else if (action === 'get-api-discovery') {
            // ดึงข้อมูล API Discovery
            if (!zoneId) {
                return NextResponse.json({
                    success: false,
                    message: 'กรุณาระบุ zoneId'
                }, { status: 400 });
            }

            console.log(`🔍 กำลังดึงข้อมูล API Discovery ของ Zone: ${zoneId}...`);

            const endpoint = `/zones/${zoneId}/api_gateway/discovery`;

            const result = await callCloudflareAPI(endpoint);

            console.log('📦 Raw API Response:', JSON.stringify(result, null, 2));

            if (result.success) {
                // ตรวจสอบว่า result.result เป็น array หรือ object
                let discoveries = [];

                if (Array.isArray(result.result)) {
                    console.log('✅ result.result is an array with', result.result.length, 'elements');

                    // ตรวจสอบ element แรกว่าเป็น format อะไร
                    if (result.result.length > 0) {
                        const firstItem = result.result[0];

                        // ถ้า item มี method และ endpoint = เป็น operations format แล้ว
                        if (firstItem.method && firstItem.endpoint) {
                            console.log('✅ Data is flat operations format!');
                            discoveries = result.result.map(op => ({
                                id: op.id,
                                host: op.host || '-',
                                method: op.method || '-',
                                path: op.endpoint || '-',
                                state: op.state || '-',
                                last_seen: op.last_updated || '-',
                            }));
                        } else if (Array.isArray(firstItem)) {
                            // นี่คือ nested array - loop ผ่านทุก item
                            console.log('📋 Data is nested array format');
                            for (const item of result.result) {
                                if (Array.isArray(item)) {
                                    console.log('📊 Found nested array with', item.length, 'items');
                                    // Flatten OpenAPI schemas เป็น endpoint list
                                    for (const schema of item) {
                                        if (schema && schema.paths && typeof schema.paths === 'object') {
                                            const host = schema.info?.title?.replace('Schema for ', '') || '-';

                                            // วนลูปแต่ละ path ใน schema
                                            for (const [path, pathObj] of Object.entries(schema.paths)) {
                                                // วนลูปแต่ละ method (get, post, put, delete, etc.)
                                                for (const [method, methodObj] of Object.entries(pathObj)) {
                                                    if (typeof methodObj === 'object' && method !== 'parameters') {
                                                        discoveries.push({
                                                            host: host,
                                                            method: method.toUpperCase(),
                                                            path: path,
                                                            state: schema.state || 'review',
                                                            last_seen: schema.last_seen || schema.timestamp || '-',
                                                            features: methodObj.tags || [],
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }
                } else if (result.result && typeof result.result === 'object') {
                    // ถ้าเป็น object อาจจะมี property อื่นที่เป็น array
                    console.log('⚠️  result.result is an object:', Object.keys(result.result));

                    // ลองหา array ใน object
                    let targetArray = [];
                    if (result.result.schemas) {
                        console.log('✅ Found schemas in object');
                        targetArray = result.result.schemas;
                    } else if (result.result.discovered_origins) {
                        targetArray = result.result.discovered_origins;
                    } else if (result.result.operations) {
                        targetArray = result.result.operations;
                    } else if (result.result.endpoints) {
                        targetArray = result.result.endpoints;
                    } else {
                        // ถ้าไม่มี property ที่รู้จัก ให้ลอง value ที่เป็น array
                        targetArray = Object.values(result.result).find(v => Array.isArray(v)) || [];
                    }

                    // Process targetArray logic similar to nested array logic
                    for (const schema of targetArray) {
                        if (schema && schema.paths && typeof schema.paths === 'object') {
                            const host = schema.info?.title?.replace('Schema for ', '') || '-';

                            // วนลูปแต่ละ path ใน schema
                            for (const [path, pathObj] of Object.entries(schema.paths)) {
                                // ถ้า user ต้องการแค่ path กับ title เราดึงแค่นี้ แต่เก็บ method ไว้เผื่อใช้
                                for (const [method, methodObj] of Object.entries(pathObj)) {
                                    if (typeof methodObj === 'object' && method !== 'parameters') {
                                        discoveries.push({
                                            host: host, // This maps to Title
                                            method: method.toUpperCase(),
                                            path: path,
                                            state: schema.state || methodObj['x-cf-api-discovery-state'] || 'review',
                                            last_seen: schema.last_seen || schema.timestamp || '-',
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                console.log(`✅ พบ ${discoveries.length} API Discovery endpoints`);
                if (discoveries.length > 0) {
                    console.log('📊 Sample data:', JSON.stringify(discoveries.slice(0, 2), null, 2));
                }

                // เตรียมข้อมูล Raw สำหรับส่งกลับ
                let rawSample = null;
                if (Array.isArray(result.result)) {
                    rawSample = result.result.slice(0, 2);
                } else if (result.result && typeof result.result === 'object') {
                    // ถ้าเป็น object ให้ส่งตัวอย่าง keys หรือข้อมูลบางส่วน
                    rawSample = {
                        keys: Object.keys(result.result),
                        data_preview: result.result
                    };
                }

                return NextResponse.json({
                    success: true,
                    message: `พบ ${discoveries.length} API Discovery endpoints`,
                    data: discoveries,
                    raw: {
                        total: Array.isArray(result.result) ? result.result.length : discoveries.length,
                        type: Array.isArray(result.result) ? 'array' : typeof result.result,
                        result_info: result.result_info,
                        sample: rawSample
                    }
                });
            } else {
                console.log('❌ API returned success: false');
                return NextResponse.json({
                    success: false,
                    message: 'Cloudflare API returned error',
                    error: result.errors || result
                }, { status: 500 });
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
            'get-account-info - ดึงข้อมูล Account',
            'get-api-discovery - ดึงข้อมูล API Discovery (ต้องระบุ zoneId)'
        ]
    });
}
