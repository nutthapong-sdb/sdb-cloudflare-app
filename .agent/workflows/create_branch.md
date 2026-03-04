---
description: [MANDATORY] สร้าง Branch ใหม่จากเนื้อหาที่ผู้ใช้ระบุ โดยห้ามทำการแก้ไขโค้ดใดๆ อย่างเด็ดขาด
---

// turbo
1. **สร้าง Branch ใหม่ตามข้อมูลที่ผู้ใช้ระบุ (Auto-Execute):**
   - **กฎเหล็กที่ 1 (สำคัญมาก):** ห้ามแก้ไข อ่าน หรือแตะต้องโค้ดใดๆ ระหว่างการรัน Workflow นี้ ให้ทำแค่สร้าง Branch เท่านั้น
   - **กฎเหล็กที่ 2:** การตั้งชื่อ Branch ต้องปฏิบัติตาม **Naming Convention** นี้:
     - Feature ใหม่: `feature/[system]/[description-kebab-case]`
     - แก้ไข Bug: `fix/[system]/[description-kebab-case]`
     - ปรับโครงสร้าง/Refactor: `refactor/[system]/[description-kebab-case]`
   - **Action:** วิเคราะห์ Requirement ที่ผู้ใช้ให้มา สร้างเป็นชื่อ Branch (kebab-case) ดึงโค้ดล่าสุดจาก main แล้วสลับไปที่ Branch ใหม่
   ```bash
   git checkout main && git pull origin main
   git checkout -b [branch-name]
   ```

2. **ยืนยัน Branch ปัจจุบัน:**
   - ตรวจสอบว่าได้สลับมายัง Branch ใหม่เรียบร้อยแล้ว แจ้งผลให้ผู้ใช้ทราบ และ *รอคำสั่งต่อไป* โดยห้ามมั่วไปแก้โค้ดเอง
   ```bash
   git branch --show-current
   ```
