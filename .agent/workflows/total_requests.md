---
description: ตรวจสอบจำนวน Total Request ของโดเมนหรือซับโดเมนที่ระบุ
---
ถ้าต้องการตรวจสอบจำนวน Traffic หรือ Total Request ให้ทำตามขั้นตอนดังนี้:

1. ใช้ไฟล์ `scripts/total_requests/test-total-requests.js`
// turbo
2. รันคำสั่ง โดยระบุชื่อ Account, Zone และ Host (ถ้าต้องการดูเฉพาะเจาะจง):
```bash
node scripts/total_requests/test-total-requests.js "Account Name" "zone.com" "host.zone.com"
```
