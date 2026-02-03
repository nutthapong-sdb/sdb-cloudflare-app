const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// --- Configuration ---
const API_BASE_URL = 'http://localhost:8002/api/scrape';
const DB_PATH = path.join(__dirname, '../../db/sdb_users.db');

// Edit these values to match your testing environment
const TARGET_CONFIG = {
    accountName: "BDMS Group1",
    zoneName: "bdms.co.th",
    subDomain: "ALL_SUBDOMAINS",
    timeRange: 43200 // 30 days
};

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

async function getApiTokenFromDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(new Error(`Could not connect to database: ${err.message}`));
        });
        const sql = `SELECT cloudflare_api_token FROM users WHERE cloudflare_api_token IS NOT NULL AND cloudflare_api_token != '' LIMIT 1`;
        db.get(sql, [], (err, row) => {
            db.close();
            if (err) return reject(err);
            if (row && row.cloudflare_api_token) resolve(row.cloudflare_api_token);
            else reject(new Error('No API Token found in database.'));
        });
    });
}

async function main() {
    log('🚀 Starting Template Variable Validation Script...', colors.cyan);
    log('--------------------------------------------------');

    let apiToken;
    try {
        apiToken = await getApiTokenFromDb();
        log('✅ Retrieved API Token.');
    } catch (e) {
        log(`❌ Error: ${e.message}`, colors.red);
        process.exit(1);
    }

    const headers = { 'Content-Type': 'application/json' };
    const callAPI = (action, params) => axios.post(API_BASE_URL, { action, ...params, apiToken }, { headers }).then(r => r.data);

    try {
        // 1. Get Account
        log('\n1. Identifying Account & Zone...', colors.blue);
        const accRes = await callAPI('get-account-info', {});
        if (!accRes.success) throw new Error(`Account API Failed: ${accRes.message}`);
        const account = accRes.data.find(a => (a.name || '').trim().toLowerCase().includes(TARGET_CONFIG.accountName.toLowerCase())) || accRes.data[0];
        log(`   Selected Account: ${account.name} (${account.id})`);

        // 2. Get Zone
        const zoneRes = await callAPI('list-zones', { accountId: account.id });
        if (!zoneRes.success) throw new Error(`Zone API Failed: ${zoneRes.message}`);
        const zone = zoneRes.data.find(z => z.name === TARGET_CONFIG.zoneName) || zoneRes.data[0];
        log(`   Selected Zone: ${zone.name} (${zone.id})`);

        // 3. Fetch All Data
        log('\n2. Fetching Cloudflare Data From API...', colors.blue);

        log('   📡 Fetching Traffic Analytics...');
        const trafficParams = {
            zoneId: zone.id,
            timeRange: TARGET_CONFIG.timeRange,
            subdomain: TARGET_CONFIG.subDomain === 'ALL_SUBDOMAINS' ? null : TARGET_CONFIG.subDomain
        };
        const trafficRes = await callAPI('get-traffic-analytics', trafficParams);

        log('   📡 Fetching Zone Settings...');
        const settingsRes = await callAPI('get-zone-settings', { zoneId: zone.id });

        log('   📡 Fetching DNS Records...');
        const dnsRes = await callAPI('get-dns-records', { zoneId: zone.id });

        if (!trafficRes.success) log('   ⚠️ Traffic Analytics Warning: ' + trafficRes.message, colors.yellow);
        if (!settingsRes.success) log('   ⚠️ Zone Settings Warning: ' + settingsRes.message, colors.yellow);
        if (!dnsRes.success) log('   ⚠️ DNS Records Warning: ' + dnsRes.message, colors.yellow);

        const tData = trafficRes.data || {};
        const sData = settingsRes.data || {};
        const dData = dnsRes.data || [];

        // Debug: Check customRules structure
        log('\n--- DEBUG: Custom Rules Data Inspection ---', colors.cyan);
        if (sData.customRules) {
            log(`Custom Rules Status: ${sData.customRules.status}`);
            log(`Custom Rules Count: ${sData.customRules.rules?.length || 0}`);
            if (sData.customRules.rules && sData.customRules.rules.length > 0) {
                log('First Custom Rule:', colors.yellow);
                console.log(JSON.stringify(sData.customRules.rules[0], null, 2));
            }
        } else {
            log('⚠️ No customRules data in settings response', colors.yellow);
        }

        // --- AGGREGATION & MAPPING ---
        const httpRequests = tData.httpRequestsAdaptiveGroups || [];
        const zoneSummary = tData.zoneSummary || [];

        const zoneRequests = zoneSummary.reduce((sum, r) => sum + (r.sum.requests || 0), 0);
        const adaptiveRequests = httpRequests.reduce((sum, r) => sum + (r.count || 0), 0);

        // --- VALIDATION REPORT ---
        log('\n--- TEMPLATE VARIABLE DATA STATUS ---\n', colors.cyan);

        const variableGroups = [
            {
                label: 'ข้อมูลพื้นฐาน (Basic Info)',
                vars: [
                    { name: '@ACCOUNT_NAME', value: account.name },
                    { name: '@ZONE_NAME', value: zone.name },
                    { name: '@TOTAL_REQ', value: adaptiveRequests.toLocaleString(), status: adaptiveRequests > 0 ? 'PASS' : 'EMPTY' },
                    { name: '@ZONE_TOTAL_REQ', value: zoneRequests.toLocaleString(), status: zoneRequests > 0 ? 'PASS' : 'EMPTY' }
                ]
            },
            {
                label: 'ตัวแปรค่าเดี่ยว (Single Top Values)',
                vars: [
                    { name: '@TOP_IP_VAL', value: httpRequests[0]?.dimensions?.clientIP || '-', status: httpRequests[0]?.dimensions?.clientIP ? 'PASS' : 'EMPTY' },
                    { name: '@TOP_UA_VAL', value: httpRequests[0]?.dimensions?.userAgent ? 'Loaded' : '-', status: httpRequests[0]?.dimensions?.userAgent ? 'PASS' : 'EMPTY' },
                    { name: '@TOP_HOST_VAL', value: httpRequests[0]?.dimensions?.clientRequestHTTPHost || '-', status: httpRequests[0]?.dimensions?.clientRequestHTTPHost ? 'PASS' : 'EMPTY' }
                ]
            },
            {
                label: 'สถิติความปลอดภัย (Security)',
                vars: [
                    { name: '@BOT_MANAGEMENT_STATUS', value: sData.botManagement?.enabled ? 'Enabled' : 'Disabled', status: 'PASS' },
                    { name: '@BLOCK_AI_BOTS', value: sData.botManagement?.blockAiBots || 'unknown', status: 'PASS' },
                    { name: '@SSL_MODE', value: sData.sslMode || '-', status: sData.sslMode ? 'PASS' : 'EMPTY' },
                    { name: '@DNS_RECORDS', value: dData.length > 0 ? dData.length + ' records' : 'No records', status: dData.length > 0 ? 'PASS' : 'EMPTY' }
                ]
            },
            {
                label: 'Table & List Placeholders (from Settings API)',
                vars: [
                    { name: '@CUSTOM_RULES_ROWS', value: sData.customRules?.rules?.length > 0 ? `${sData.customRules.rules.length} rules` : '-', status: sData.customRules?.rules?.length > 0 ? 'PASS' : 'EMPTY' },
                    { name: '@DNS_TOTAL_ROWS', value: dData.filter(r => r.proxied).length > 0 ? 'Data Available' : '-', status: dData.filter(r => r.proxied).length > 0 ? 'PASS' : 'EMPTY' }
                ]
            },
            {
                label: 'Dynamic Lists (from Traffic Analytics)',
                vars: [
                    { name: '@TOP_PATHS_LIST', value: httpRequests.length > 0 ? 'Data Available' : '-', status: httpRequests.length > 0 ? 'PASS' : 'EMPTY' },
                    { name: '@TOP_CUSTOM_RULES_LIST', value: (tData.firewallRules || []).some(r => (r.dimensions?.source || '').toLowerCase().includes('custom')) ? 'Data Available' : '-', status: (tData.firewallRules || []).some(r => (r.dimensions?.source || '').toLowerCase().includes('custom')) ? 'PASS' : 'EMPTY' },
                    { name: '@TOP_MANAGED_RULES_LIST', value: (tData.firewallRules || []).some(r => (r.dimensions?.source || '').toLowerCase().includes('managed') || (r.dimensions?.source || '').toLowerCase().includes('waf')) ? 'Data Available' : '-', status: (tData.firewallRules || []).some(r => (r.dimensions?.source || '').toLowerCase().includes('managed') || (r.dimensions?.source || '').toLowerCase().includes('waf')) ? 'PASS' : 'EMPTY' }
                ]
            }
        ];

        variableGroups.forEach(group => {
            log(`[ ${group.label} ]`, colors.yellow);
            group.vars.forEach(v => {
                const s = v.status || (v.value !== '-' && v.value !== 'No records' ? 'PASS' : 'EMPTY');
                const statusColor = s === 'PASS' ? colors.green : colors.yellow;
                console.log(`  ${v.name.padEnd(30)}: [${statusColor}${s.padEnd(5)}${colors.reset}] ${v.value}`);
            });
            console.log('');
        });

        log('--------------------------------------------------');
        log('✅ Validation Completed.');
        log(`${colors.green}PASS${colors.reset} : Data is available and variable will be populated.`);
        log(`${colors.yellow}EMPTY${colors.reset}: API call was successful, but no data exists for this item in this time range.`);

    } catch (e) {
        log(`❌ Validation Failed: ${e.message}`, colors.red);
        if (e.stack) console.log(e.stack);
    }
}

main();
