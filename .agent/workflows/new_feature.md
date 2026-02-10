---
description: ขั้นตอนการพัฒนาและทดสอบฟีเจอร์ใหม่ (New Feature Development & Testing Protocol)
---

ทุกครั้งที่มีผู้ใช้ขอให้เพิ่มฟีเจอร์ใหม่เข้ามาในระบบ ให้ปฏิบัติตามขั้นตอนดังนี้อย่างเคร่งครัด:

1. **วิเคราะห์ความต้องการ (Requirement Analysis):**
   - ทำความเข้าใจฟีเจอร์ที่ต้องการเพิ่ม
   - ออกแบบการเปลี่ยนแปลงทั้ง Frontend และ Backend

2. **พัฒนาฟีเจอร์ (Implementation):**
   - เขียนโค้ด Backend (API Route, Server Action)
   - เขียนโค้ด Frontend (UI Component, Page Logic)

3. **สร้าง Script ทดสอบ (Mandatory Testing Scripts):**
   ต้องสร้าง Script ทดสอบขึ้นมาใหม่ 2 ไฟล์ในโฟลเดอร์ `scripts/feature_test/` (สร้างโฟลเดอร์หากยังไม่มี):

   **รูปแบบที่ 1: Backend Logic Test (`test-[feature]-backend.js`)**
   - เขียนด้วย Node.js (ใช้ `axios`, `dotenv`)
   - ทดสอบการเชื่อมต่อ API, Data Validation, และ Business Logic ของฟีเจอร์นั้นๆ โดยตรง
   - ตรวจสอบ Response ว่าถูกต้องตามที่คาดหวัง

   **รูปแบบที่ 2: Frontend Headless UI Test (`test-[feature]-ui.js`)**
   - เขียนด้วย Node.js + Puppeteer
   - ตั้งค่า Browser เป็น mode `headless: "new"` (ไม่แสดงหน้าต่าง) เพื่อความรวดเร็วและรองรับ CI/CD environment
   - จำลอง User Flow: Login -> Navigate -> Interact (Click, Type) -> Verify Result (Check Element, Text, Screenshot)

4. **ดำเนินการทดสอบ (Execution):**
   - รัน Script ทั้งสองไฟล์เพื่อยืนยันความถูกต้อง
   - แก้ไขบั๊กที่พบจากการทดสอบ

5. **ส่งมอบงาน (Delivery):**
   - ยืนยันผลการทดสอบกับผู้ใช้งาน
   - แนบรายชื่อไฟล์ Script ที่สร้างขึ้นในรายงาน

**Example Command:**
// turbo-all
mkdir -p scripts/feature_test
node scripts/feature_test/test-my-feature-backend.js
node scripts/feature_test/test-my-feature-ui.js
