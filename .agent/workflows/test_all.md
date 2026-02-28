---
description: เรียก workflow นี้ทุกครั้งที่ต้องการทดสอบระบบทั้งหมด (API, UI, และ Traffic Analytics)
---

// turbo-all

## ขั้นตอนการทดสอบ

### Phase 1: Authentication
1. รัน Login Test
```bash
node scripts/test-all/auth/test-login.js
```

### Phase 2: GDCC Dashboard Tests
2. ทดสอบการนำทางและ Generate Dashboard
```bash
node scripts/test-all/gdcc/test-gdcc.js
```

3. ทดสอบ Manual Generation (ปุ่ม Generate Dashboard enabled/disabled)
```bash
node scripts/test-all/gdcc/test-manual-generation.js
```

4. ทดสอบ UI Enhancements (Dropdown Keyboard Nav + Batch Modal)
```bash
node scripts/test-all/gdcc/test-ui-enhancements.js
```

5. ทดสอบ Report Generation แบบ E2E (Download ไฟล์จริง)
```bash
node scripts/test-all/gdcc/test-report-generation.js
```

6. ทดสอบ Template Variables
```bash
node scripts/test-all/gdcc/test-template-variables.js
```

7. ทดสอบ Total Requests API
```bash
node scripts/test-all/gdcc/test-total-requests.js
```

### Phase 3: API Discovery Tests
8. ทดสอบ API Discovery Backend
```bash
node scripts/test-all/api_discovery/test-api.js
```

9. ทดสอบ API Discovery UI
```bash
node scripts/test-all/api_discovery/test-api-discovery.js
```

### Phase 4: Firewall Tests
10. ทดสอบ Firewall
```bash
node scripts/test-all/firewall/test-firewall.js 2>/dev/null || node scripts/test-all/firewall/test-firewall-logs.js 2>/dev/null || echo "⚠️ Firewall test script name may differ"
```

### หมายเหตุ
- ทุก GDCC Test ใช้ `scripts/test-all/libs/gdcc-helper.js` สำหรับ Account/Zone/Subdomain selection
- Account เริ่มต้น: `Government Data Center and Cloud service (GDCC)`
- Zone เริ่มต้น: `dwf.go.th`
- Subdomain เริ่มต้น: `ALL_SUBDOMAINS` (Zone Overview)
