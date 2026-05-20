# FireGuard QR Dashboard

แดชบอร์ดติดตามการตรวจสอบถังดับเพลิงสำหรับทีม ENV โรงพยาบาลบางคล้า พัฒนาด้วย Next.js และพร้อม deploy บน Vercel

## ความสามารถหลัก

- โหลดข้อมูลอัตโนมัติจาก Google Apps Script API เมื่อเปิดหน้าเว็บ
- KPI: ถังทั้งหมด, ตรวจแล้ว, ยังไม่ตรวจ, ความครบถ้วน
- เลือกกรองข้อมูลตามเดือนด้วย dropdown
- ตารางถังทั้งหมด
- ตารางถังที่ยังไม่ตรวจ
- แผนผังถังดับเพลิงจากไฟล์ `/maps/er-floor1.png`
- ใช้รูปแผนผังจากไฟล์ที่อัปโหลดไว้ใน `public/maps/er-floor1.png` โดยตรง
- แสดง marker ตาม `mapX`/`mapY`
  - เขียว = ตรวจแล้ว
  - แดง = ยังไม่ตรวจ
  - เทา = ไม่มีข้อมูล
- คลิก marker เพื่อดูรายละเอียดถัง
- UI ภาษาไทย โทนเขียว-ขาว รองรับมือถือและคอม

## เริ่มใช้งานในเครื่อง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

## Deploy บน Vercel

### วิธีที่ 1: ผ่านหน้าเว็บ Vercel

1. Push โปรเจกต์ขึ้น GitHub
2. เข้า https://vercel.com และกด **Add New... > Project**
3. เลือก repository นี้
4. Framework Preset จะตรวจจับเป็น **Next.js** อัตโนมัติ
5. กด **Deploy**

### วิธีที่ 2: ผ่าน Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

สำหรับ production:

```bash
vercel --prod
```

## แหล่งข้อมูล API

ระบบดึงข้อมูลจาก URL นี้โดยตรง (ไม่ต้องให้ผู้ใช้กรอกเอง):

`https://script.google.com/macros/s/AKfycbyykPLFJX4QlL--C3-E-F0Ji-lt516M7UB2BtTRv05G2ttkf7jt-QpDSqEw2A9fwjlUXQ/exec`
