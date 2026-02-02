---
description: ตรวจสอบ DNS Record และ Load Balancer ของโดเมนที่ระบุ
---
ถ้าต้องการตรวจสอบเกี่ยวกับ DNS Record หรือ Load Balancer ให้ทำตามขั้นตอนดังนี้:

1. ตรวจสอบว่าระบบรันอยู่
2. ใช้ไฟล์ `scripts/dns_check/test-dns-specific.js`
// turbo
3. รันคำสั่ง โดยระบุชื่อ Account และ Zone (ถ้าไม่ระบุจะใช้ค่าเริ่มต้น):
```bash
node scripts/dns_check/test-dns-specific.js "Account Name" "zone.com"
```
