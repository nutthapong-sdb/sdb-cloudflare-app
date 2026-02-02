---
description: ดาวน์โหลดรายงาน Domain Report หรือ Batch Report
---
ถ้าต้องการดาวน์โหลดไฟล์รายงาน ให้ทำตามขั้นตอนดังนี้:

### สำหรับ Domain Report (รายโดเมน)
1. ใช้ไฟล์ `scripts/download_reports/test-download-domain-report.js`
// turbo
2. รันคำสั่ง โดยระบุชื่อ Account และ Zone:
```bash
node scripts/download_reports/test-download-domain-report.js "Account Name" "zone.com"
```

### สำหรับ Batch Report (หลายโดเมน)
1. ใช้ไฟล์ `scripts/download_reports/test-download-batch-report.js`
// turbo
2. รันคำสั่ง โดยระบุชื่อ Account, Zone และ List ของ Subdomain:
```bash
node scripts/download_reports/test-download-batch-report.js "Account Name" "zone.com" "sub1,sub2,sub3"
```
