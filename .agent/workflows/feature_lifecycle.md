---
description: ขั้นตอนการพัฒนามาตรฐานตั้งแต่เริ่มจนจบงาน (Standard Development Lifecycle)
---

1. **เริ่มต้นงาน (Start Task):**
   - สร้าง Branch ใหม่ตาม Naming Convention
   - อ้างอิง Workflow: `.agent/workflows/create_branch.md`

2. **พัฒนาและแก้ไข (Implementation):**
   - เขียนโค้ดหรือแก้ไขฟีเจอร์ตามความต้องการ
   - ตรวจสอบความถูกต้องเบื้องต้น

3. **ทดสอบ (Verify & Test):**
   - สร้างและรัน Test Script สำหรับฟีเจอร์นั้นๆ
   - อ้างอิง Workflow: `.agent/workflows/new_feature.md`

4. **ส่งมอบงาน (Commit & Deploy):**
   - เมื่อผลการทดสอบผ่าน หรือผู้ใช้ยืนยัน (Approve/Commit)
   - ดำเนินการ Commit, Push (CI), และ Merge เข้า Main
   - อ้างอิง Workflow: `.agent/workflows/git_push.md`
