---
description: ตรวจสอบ Branch, Commit, Merge เข้า Main และ Publish Branch
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

3. **Merge to Main (รวมโค้ดเข้า Main):**
   - สลับไป Branch Main และดึงข้อมูลล่าสุด
   ```bash
   git checkout main
   git pull origin main
   ```
   - Merge Feature Branch (แทนที่ `[feature-branch]` ด้วยชื่อจากขั้นตอนที่ 1)
   ```bash
   git merge [feature-branch] --no-ff
   ```
   - Push Main ขึ้น GitHub (Update Production)
   ```bash
   git push origin main
   ```

4. **Publish Feature Branch (Update Online):**
   - สลับกลับมายัง Feature Branch
   ```bash
   git checkout [feature-branch]
   ```
   - Push Feature Branch ขึ้น GitHub (เพื่อให้ Branch ออนไลน์เป็นปัจจุบัน)
   ```bash
   git push -u origin [feature-branch]
   ```