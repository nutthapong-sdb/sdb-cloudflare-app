---
description: สร้าง Branch ใหม่สำหรับฟีเจอร์ตามหลักการตั้งชื่อ (Naming Convention)
---

1. **วิเคราะห์ชื่อ Branch (Naming Analysis):**
   - ตรวจสอบว่าฟีเจอร์นี้เกี่ยวข้องกับ System ใด (เช่น `gdcc`, `firewall`, `api_discovery`, `auth`, หรือ `global`)
   - สรุปสิ่งที่ทำเป็นภาษาอังกฤษสั้นๆ (kebab-case)
   - **Format:** `feature/[system]/[description]`
   - ตัวอย่าง: `feature/gdcc/live-search-modal`

2. **สร้างและสลับไปยัง Branch ใหม่:**
   ```bash
   git checkout -b feature/[system]/[description]
   ```
