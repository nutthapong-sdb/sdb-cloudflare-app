---
description: Debug และทดสอบตัวแปรที่ไม่แสดงผลใน Report
---

# Workflow: Debug Missing Template Variable

เมื่อผู้ใช้รายงานว่า **"ข้อมูลของตัวแปร `@VARIABLE_NAME@` ไม่ขึ้น"** ให้ทำตามขั้นตอนนี้:

---

## เงื่อนไขเบื้องต้น (Prerequisites)

ก่อนเริ่ม Debug ให้แน่ใจว่า:
1. ไฟล์ `.env.local` มี `CLOUDFLARE_API_TOKEN=your_token` อยู่
2. Dev server กำลังรันอยู่ที่ `localhost:8002`

---

## Step 1: ระบุตัวแปรที่มีปัญหา
ถามผู้ใช้ว่าตัวแปรใดที่ไม่แสดงผล (เช่น `@FW_TOTAL_EVENTS@`, `@TOP_HOST_VAL@`)

---

## Step 2: สร้าง Debug Script สำหรับตัวแปรนั้นๆ

สร้างไฟล์ใหม่ใน `scripts/debug/test-{variable-name}.js` โดยอ้างอิงจาก Template นี้:

```javascript
// Test script for @VARIABLE_NAME@
const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

const BASE_URL = 'http://localhost:8002/api/scrape';
const accountName = process.argv[2] || 'BDMS Group1';
const zoneName = process.argv[3] || 'bdms.co.th';
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

async function testVariable() {
    try {
        if (!apiToken) {
            log('❌ Error: CLOUDFLARE_API_TOKEN not found in .env.local', colors.red);
            return;
        }

        console.log('🔍 Testing @VARIABLE_NAME@...\n');
        log(`   Token: ${apiToken.substring(0, 4)}...${apiToken.slice(-4)}`, colors.green);

        // Call API
        const response = await axios.post(BASE_URL, {
            action: 'get-traffic-analytics',
            zoneId: zoneName,
            timeRange: 1440,
            subdomain: null,
            apiToken: apiToken
        });

        if (!response.data.success) {
            log('❌ API Error: ' + response.data.error, colors.red);
            return;
        }

        const data = response.data.data;
        
        // TODO: Extract specific variable data here
        const variableValue = data?.specificField || null;
        
        console.log('\n✅ Result:');
        log(`   @VARIABLE_NAME@: "${variableValue}"`, colors.cyan);
        
        if (!variableValue || variableValue === 0) {
            log('\n⚠️  WARNING: Variable is empty!', colors.yellow);
        } else {
            log('\n✅ Variable has value', colors.green);
        }
        
        return variableValue;
    } catch (error) {
        log('❌ Error: ' + error.message, colors.red);
        return null;
    }
}

testVariable();
```

---

## Step 3: แก้ไข Script ให้ตรงกับตัวแปรที่ทดสอบ

ปรับส่วน `// TODO: Extract specific variable data` ให้ตรงกับข้อมูลที่ต้องการ:

**ตัวอย่าง `@FW_TOTAL_EVENTS@`:**
```javascript
const firewallSources = data?.firewallSources || [];
let fwTotal = 0;
firewallSources.forEach(item => {
    fwTotal += item.count;
});
const variableValue = fwTotal;
```

**ตัวอย่าง `@TOP_HOST_VAL@`:**
```javascript
const httpRequests = data?.httpRequestsAdaptiveGroups || [];
const hostCounts = {};
httpRequests.forEach(g => {
    const host = g.dimensions?.clientRequestHTTPHost || 'Unknown';
    hostCounts[host] = (hostCounts[host] || 0) + g.count;
});
const topHosts = Object.entries(hostCounts)
    .sort((a, b) => b[1] - a[1]);
const variableValue = topHosts.length > 0 ? topHosts[0][0] : '-';
```

---

// turbo
## Step 4: รัน Script และดูผลลัพธ์ใน Terminal

```bash
node scripts/debug/test-{variable-name}.js
```

**ผลลัพธ์จะแสดงใน Terminal:**
- ✅ ถ้า Script แสดงข้อมูลถูกต้อง → ปัญหาอยู่ที่ **Frontend** (processTemplate/reportData)
- ❌ ถ้า Script แสดง `null`, `0`, หรือ Error → ปัญหาอยู่ที่ **Backend/API**

---

## Step 5: แก้ไขปัญหาตามผลการทดสอบ

### กรณีที่ 1: Terminal แสดงค่าถูกต้อง แต่หน้าเว็บไม่แสดง
**สาเหตุ:** ปัญหาอยู่ที่การแสดงผล (Frontend)

**การแก้ไข:**
1. ตรวจสอบ `reportData` object (ในไฟล์ `app/systems/gdcc/page.js` บรรทัด ~2020-2080)
2. ตรวจสอบ `replacements` object ใน `processTemplate` (บรรทัด ~180-260)
3. เพิ่ม Debug:
   ```javascript
   console.log('🔍 @VARIABLE_NAME@:', replacements['@VARIABLE_NAME@']);
   ```
4. ตรวจสอบว่า Template มีตัวแปรนี้หรือไม่

### กรณีที่ 2: Terminal แสดงค่าเป็น null/0/error
**สาเหตุ:** ปัญหาอยู่ที่การดึงข้อมูล (Backend/API)

**การแก้ไข:**
1. ตรวจสอบว่า API Response มีฟิลด์ที่ต้องการหรือไม่
2. ตรวจสอบ Logic ใน `fetchAndApplyTrafficData` 
3. ตรวจสอบว่า State ถูก Set ถูกต้องหรือไม่
4. ตรวจสอบว่า API Token มีสิทธิ์เข้าถึงข้อมูลหรือไม่

---

## Step 6: ทดสอบอีกครั้งหลังแก้ไข

1. รัน Script ใน Terminal อีกครั้ง
2. ถ้าผ่าน → ทดสอบที่หน้าเว็บ (Generate Report)
3. ตรวจสอบว่าตัวแปรแสดงผลถูกต้องแล้ว

---

## สรุป Workflow

```
1. ระบุตัวแปรที่มีปัญหา
   ↓
2. สร้าง Debug Script
   ↓
3. แก้ไข Script ให้ตรงกับตัวแปร
   ↓
4. รัน Script (ดูผลใน Terminal)
   ↓
5a. Script ผ่าน → แก้ไข Frontend
5b. Script ไม่ผ่าน → แก้ไข Backend
   ↓
6. ทดสอบอีกครั้ง
```

---

## หมายเหตุ

- **ผลลัพธ์แสดงใน Terminal** (ไม่ใช่ Browser Console)
- Script ใช้ Token จาก `.env.local` (ไม่ใช่ Database)
- ค่า Default: Account = `BDMS Group1`, Zone = `bdms.co.th`, Time Range = `1440` นาที (24 ชม.)
- สามารถ Override ค่าได้: `node test-script.js "Account" "zone.com"`
- Script ทั้งหมดเก็บไว้ที่ `scripts/debug/test-*.js`
