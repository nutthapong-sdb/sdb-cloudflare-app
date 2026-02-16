---
description: [MANDATORY] สร้าง Branch ใหม่ทุกครั้งที่มีการเริ่มงาน Feature หรือ Fix Bug
---

// turbo
1. **สร้าง Branch ใหม่ทันที (Auto-Execute):**
   - **กฎเหล็ก:** ห้ามแก้ไขโค้ดบน `main` โดยเด็ดขาด
   - **Naming Convention:**
     - Feature ใหม่: `feature/[system]/[description-kebab-case]`
     - แก้ไข Bug: `fix/[system]/[description-kebab-case]`
   - **Action:** รันคำสั่งสร้าง Branch ตามชื่อที่เหมาะสมทันที
   ```bash
   git checkout -b [branch-name]
   ```

2. **ยืนยัน Branch ปัจจุบัน:**
   - ตรวจสอบว่าได้สลับมายัง Branch ใหม่แล้วจริง
   ```bash
   git branch --show-current
   ```
