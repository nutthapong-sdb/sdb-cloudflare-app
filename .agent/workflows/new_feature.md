---
description: ขั้นตอนการพัฒนา แก้ไข และทดสอบฟีเจอร์ (Feature Development, Modification & Testing Protocol)
---

ทุกครั้งที่มีผู้ใช้ขอให้เพิ่มฟีเจอร์ใหม่ หรือแก้ไขฟีเจอร์เดิมที่มีอยู่ ให้ปฏิบัติตามขั้นตอนดังนี้อย่างเคร่งครัด:

1. **วิเคราะห์ความต้องการ (Requirement Analysis & Impact Assessment):**
   - **กรณีฟีเจอร์ใหม่:** ทำความเข้าใจฟีเจอร์ที่ต้องการเพิ่ม และออกแบบโครงสร้าง Frontend/Backend
   - **กรณีแก้ไขฟีเจอร์เดิม:** วิเคราะห์โค้ดเดิมเพื่อดูผลกระทบ (Impact Analysis) ที่อาจเกิดขึ้นกับส่วนอื่นของระบบ

2. **พัฒนา/แก้ไขฟีเจอร์ (Implementation):**
   - เขียนหรือแก้ไขโค้ด Backend (API Route, Server Action)
   - เขียนหรือแก้ไขโค้ด Frontend (UI Component, Page Logic)

3. **จัดการ Script ทดสอบ (Test Scripts Management):**
   ต้องมี Script ทดสอบสำหรับฟีเจอร์นั้นๆ เสมอ โดยเก็บไว้ในโฟลเดอร์ตามระบบ `scripts/test-all/[system_name]/` (เช่น `gdcc`, `firewall`, `api_discovery`):

   - **กรณีฟีเจอร์ใหม่:** สร้างไฟล์ทดสอบใหม่ 2 ไฟล์
   - **กรณีแก้ไขฟีเจอร์เดิม:** อัปเดตไฟล์ทดสอบเดิมที่มีอยู่ หรือสร้างใหม่หากจำเป็น

   **รูปแบบที่ 1: Backend Logic Test (`test-[feature]-backend.js` หรืออัปเดตไฟล์เดิม)**
   - เขียนด้วย Node.js (ใช้ `axios`, `dotenv`)
   - ทดสอบการเชื่อมต่อ API, Data Validation, และ Business Logic ของฟีเจอร์นั้นๆ โดยตรง
   - ตรวจสอบ Response ว่าถูกต้องตามที่คาดหวัง

   **รูปแบบที่ 2: Frontend Headless UI Test (`test-[feature]-ui.js` หรืออัปเดตไฟล์เดิม)**
   - เขียนด้วย Node.js + Puppeteer
   - ใช้ `libs/ui-helper.js` เพื่อจัดการ Browser/Page/Login
   - จำลอง User Flow: Login -> Navigate -> Interact (Click, Type) -> Verify Result (Check Element, Text, Screenshot)

   **สำคัญ:** เมื่อสร้างหรือแก้ไข Script ทดสอบเสร็จสิ้น ให้เพิ่ม path ของไฟล์ Script นั้นลงใน `.agent/workflows/test_all.md` เสมอ เพื่อให้ถูกเรียกใช้งานในการทดสอบรวม (Regression Test)

4. **ดำเนินการทดสอบ (Execution):**
   - รัน Script ทั้งสองไฟล์เพื่อยืนยันความถูกต้อง
   - หากเป็นการแก้ไขฟีเจอร์เดิม ให้รัน Test Suite ทั้งหมดของระบบนั้นๆ เพื่อป้องกัน Regression

5. **ส่งมอบงาน (Delivery):**
   - ยืนยันผลการทดสอบกับผู้ใช้งาน
   - แนบรายชื่อไฟล์ Script ที่สร้างหรือแก้ไขในรายงาน

**Example Command:**
// turbo-all
# Example for a new feature in GDCC system
mkdir -p scripts/test-all/gdcc
node scripts/test-all/gdcc/test-my-feature-backend.js
node scripts/test-all/gdcc/test-my-feature-ui.js
