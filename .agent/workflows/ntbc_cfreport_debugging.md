---
description: คู่มือและข้อควรระวังในการทดสอบและแก้ปัญหาหน้า NTBC CFReport (การตั้งค่า วันที่ และเซสชัน Cloudflare)
---

# NTBC CFReport Generation & Debugging Guide

ไฟล์นี้ใช้สำหรับอ้างอิงขั้นตอนและข้อควรระวัง เมื่อต้องการพัฒนา แก้ไข หรือทดสอบฟีเจอร์การสร้าง Report ในระบบ NTBC

## 1. การจัดการ Session Cloudflare (Live Browser Monitor)
ปัญหาที่พบบ่อยที่สุดในการดึงข้อมูลจากหน้าเว็บ Cloudflare ผ่าน Puppeteer/Docker คือ **Session หมดอายุ หรือ ติด Captcha**
- ระบบจะตรวจสอบ HTTP Status Code `401` หรือข้อความเตือน `unauthenticated` จากฝั่งเซิร์ฟเวอร์
- **พฤติกรรมที่ถูกต้องของ UI**:
  - โค้ดส่วนหน้าบ้าน (Frontend) จะทำการ `catch` Error ที่ชื่อว่า `UNAUTHENTICATED_CLOUDFLARE`
  - ระบบจะทำการเรียกเปิดหน้าต่าง VNC Modal (`setIsVncModalOpen(true)`) เด้งขึ้นมากลางจอทันที
  - **ห้าม** แสดง `Swal.fire` แจ้งเตือนทับหน้าต่าง VNC เพราะจะไปบล็อกการมองเห็นหน้าจอ ทำให้ผู้ใช้สับสนและไม่สามารถล็อกอินได้ทันที

## 2. การจัดการข้อผิดพลาดระหว่างดึงข้อมูล (Silent Error Prevention)
หากผู้ใช้เลือกดึงข้อมูลทีละหลายโดเมน (เช่น 7-8 หน้า) และเกิดการโหลดล้มเหลว (Timeout หรือเซิร์ฟเวอร์ค้าง)
- **พฤติกรรมดั้งเดิมที่ผิดพลาด**: ระบบแสดงผลเป็นแค่ไอคอนเครื่องหมายตกใจสีเหลือง ⚠️ โดยไม่มีเหตุผลบอก
- **การแก้ไขและข้อควรระวัง**: ต้องนำ `err.message` หรือ `data.message` ที่ได้จากฝั่ง API ยัดใส่เข้าตัวแปร `errorMap[statusKey]` เสมอ
- โค้ดแสดงผลในหน้าบ้านจะทำการนำข้อความใน `errorMap` ไปแสดงใต้กล่องแต่ละแถวด้วยตัวอักษรสีแดงขนาดเล็ก เพื่อให้ผู้ใช้ทราบถึงสาเหตุที่พัง

## 3. หน้า System Control Center (HTTP Traffic Options)
- หน้า `app/systems/ntbc_cfreport/control/page.js` จะมีส่วน **HTTP Traffic Option** สำหรับกำหนดตั้งค่าย้อนหลัง
- ผู้ใช้สามารถใช้งาน Quick Option (1 Day, 7 Days, 30 Days, Custom) เพื่อเซ็ตค่า `trafficTimeWindow` ได้
- เมื่อเลือกเป็น Custom ระบบจะแสดงช่อง `datetime-local` เพื่อให้ผู้ใช้กำหนด `Start Date` และ `End Date`
- ตัวแปรเหล่านี้จะถูกแนบไปกับ Query String ตอนที่เซิร์ฟเวอร์ควบคุม Puppeteer เข้าไปที่หน้า HTTP Traffic

## 4. การทดสอบแบบอัตโนมัติ (Automated Testing)
สคริปต์ Playwright ในโฟลเดอร์ `scripts/test-all/ntbc/`
- `test-ntbc-cfreport-capture.js`: สคริปต์ทดสอบต้องถูกเขียนให้ **ดักจับกล่องแจ้งเตือน (Modal Alert)** เช่น `Swal.fire`
- หากมีการแจ้งเตือนว่า Error สคริปต์ต้องทำลายตัวเอง (Fail-fast) ทันที พร้อมพ่นข้อความ Error แจ้งให้โปรแกรมเมอร์ทราบ
- **ห้าม** เขียนให้สคริปต์รอการดาวน์โหลดไฟล์แบบหลับหูหลับตา เพราะถ้ามีแจ้งเตือนบังอยู่ สคริปต์จะค้างจนหมดเวลา (Timeout) เสียเวลาและทรัพยากร
- **ก่อนรันสคริปต์**: ต้องมั่นใจว่าได้ล็อกอินเข้าสู่ระบบ Cloudflare ใน Docker Container เอาไว้ล่วงหน้าแล้ว ผ่านหน้า Live Monitor (`http://localhost:8002/vnc`)
- **ปัญหาหุ่นยนต์พิมพ์แล้ว React ไม่จำ**: การใช้ `page.type()` หรือ `page.click()` ของ Puppeteer อาจไม่กระตุ้นให้ React 18+ เรียก `onChange` (โดยเฉพาะ `input[type="number"]` หรือ Checkbox ที่ถูกซ่อน) ส่งผลให้ค่าไม่ถูกเซฟลง `localStorage` หรือ State ไม่เปลี่ยน **วิธีแก้คือ** ต้องยิง Native Event ใน `page.evaluate` เพื่อบังคับให้ DOM ทำงาน:
  ```javascript
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(el, '150');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  ```

## 5. การอัปเดตโค้ดและปัญหา Caching
- โปรเจกต์นี้ทำงานอยู่บน **Docker Container**
- หากมีการแก้ไขไฟล์โค้ดในเครื่อง (Local) เช่นไฟล์ `page.js` หรือ API Routes แล้วพบว่า **หน้าเว็บหรือระบบไม่สะท้อนการเปลี่ยนแปลง** (ตัวอย่าง: ไม่เห็น `console.log` ที่เพิ่งเติมลงไป)
- ให้สันนิษฐานว่าโค้ดถูก "Bake" เอาไว้ใน Image แล้ว ไม่ได้เมานต์ Volume แบบ Hot-reload
- **วิธีแก้ไข**: รันคำสั่งนี้เพื่อบังคับ Build คอนเทนเนอร์ใหม่ให้ดึงโค้ดล่าสุดเข้าไป:
  ```bash
  docker-compose up -d --build app
  ```
