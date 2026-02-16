---
description: ตรวจสอบ Branch, Commit, Push (CI Trigger) และ Merge เข้า Main อัตโนมัติ
---

1. **ตรวจสอบ Branch ปัจจุบันและสถานะ (Check Branch & Status):**
   - แสดงชื่อ Branch ปัจจุบันให้ผู้ใช้ทราบเพื่อยืนยัน
   ```bash
   git branch --show-current
   git status
   ```
   *หยุดรอการยืนยันจากผู้ใช้ก่อนดำเนินการต่อ*

2. **Stage & Commit Changes:**
   - เพิ่มไฟล์ทั้งหมดและ Commit พร้อมข้อความที่เหมาะสม (ตาม Conventional Commits)
   ```bash
   git add .
   git commit -m "feat([system]): [รายละเอียดการแก้ไข]"
   ```

3. **Push Feature Branch (Trigger CI):**
   - ส่งโค้ดขึ้น GitHub เพื่อให้ CI ทำงาน (ถ้ามี)
   ```bash
   git push origin HEAD
   ```

4. **Merge to Main (รวมโค้ดเข้า Main):**
   - สลับไป Branch Main และดึงข้อมูลล่าสุด
   ```bash
   git checkout main
   git pull origin main
   ```
   - Merge Feature Branch (แทนที่ `[feature-branch]` ด้วยชื่อจากขั้นตอนที่ 1)
   ```bash
   git merge [feature-branch] --no-ff
   ```
   - Push Main ขึ้น GitHub
   ```bash
   git push origin main
   ```

5. **สลับกลับมา Feature Branch (Optional):**
   - หากต้องการทำงานต่อใน Branch เดิม
   ```bash
   git checkout [feature-branch]
   ```
