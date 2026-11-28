# backend

Elysia บน Bun ต่อฐานข้อมูล MySQL สัญญา API อยู่ใน [api-contract.md](../docs/api-contract.md)
แบบตารางและกติกาที่ backend ต้องบังคับอยู่ใน [erd-review.md](../docs/erd-review.md)

## ที่ทำแล้ว

| Method | Path | หมายเหตุ |
|---|---|---|
| POST | `/auth/login` | ล็อกบัญชีตามค่าใน `system_settings` (ผิด 5 ครั้ง ล็อก 15 นาที) |
| POST | `/auth/logout` | ลบ session ของเบราว์เซอร์นั้น |
| GET | `/me` | |

ยังไม่มี: เปลี่ยนและรีเซ็ตรหัสผ่าน, แก้ชื่อ และ endpoint ข้อมูลทั้งหมด หน้าที่เรียกเส้นทางเหล่านี้จะขึ้นข้อความผิดพลาด

## เริ่มครั้งแรก

ต้องมี Bun, pnpm และ Docker Desktop (เปิดไว้) คำสั่งทั้งหมดรันในโฟลเดอร์ `backend`

1. คัดลอก `.env.example` เป็น `.env` แล้วเติม `DB_PASSWORD`, `DATABASE_URL` และ `SEED_PASSWORD`
2. ติดตั้งแพ็กเกจ

   ```powershell
   pnpm install
   ```

3. เปิดฐานข้อมูล ครั้งแรกสร้างตารางจาก `db/schema.sql` ให้เอง

   ```powershell
   docker compose up -d --wait
   ```

4. สร้างบัญชีทดสอบ

   ```powershell
   pnpm seed
   ```

5. เปิด backend ที่ `http://127.0.0.1:4000`

   ```powershell
   pnpm dev
   ```

ปิดฐานข้อมูลด้วย `docker compose stop` ลบข้อมูลทั้งหมดเพื่อสร้างตารางใหม่ด้วย `docker compose down -v`

## ต่อกับหน้าเว็บ

เปิดอีกหน้าต่างหนึ่งที่โฟลเดอร์หลักของโปรเจกต์

```powershell
$env:NUXT_PUBLIC_API_BASE='/api'; $env:NUXT_API_SERVER_URL='http://localhost:4000'; pnpm dev
```

- เปิด `http://localhost:3000` ถ้าใช้ที่อยู่อื่น เช่น `127.0.0.1` ต้องเพิ่มใน `WEB_ORIGIN` ไม่เช่นนั้นเข้าสู่ระบบไม่ได้
- กลับไปใช้ข้อมูลจำลอง: ปิดหน้าต่างนั้นแล้วรัน `pnpm dev` ในหน้าต่างใหม่

## บัญชีทดสอบ

| อีเมล | บทบาท | รหัสผ่าน |
|---|---|---|
| `somchai.k@university.ac.th` | นักศึกษา | ค่า `SEED_PASSWORD` |
| `piyaporn.k@university.ac.th` | นักศึกษาเข้าครั้งแรก | รหัสนักศึกษา ดูใน [seed-dev.ts](scripts/seed-dev.ts) |
| `wichai.p@university.ac.th` | พี่เลี้ยง | ค่า `SEED_PASSWORD` |
| `arunee.s@university.ac.th` | แอดมิน | ค่า `SEED_PASSWORD` |
| `suspended@university.ac.th` | บัญชีถูกระงับ | ค่า `SEED_PASSWORD` |

## ทดสอบ

```powershell
docker compose --profile test up -d --wait db-test
```

```powershell
pnpm test
```

```powershell
docker compose --profile test rm -sfv db-test
```

ตรวจชนิดข้อมูลด้วย `pnpm typecheck`

## ก่อนใช้งานจริง

- ลบ `COOKIE_SECURE=false` และตั้ง `WEB_ORIGIN` เป็นที่อยู่จริงของหน้าเว็บ
- อย่าเปิดพอร์ต backend ออกภายนอก ให้รับคำขอจาก Nuxt เท่านั้น เพราะเชื่อ `X-Forwarded-For` ที่ส่งมา
- การจำกัดคำขอ `/auth/*` (ค่าเริ่มต้น 30 ครั้งต่อนาทีต่อ IP, `AUTH_RATE_LIMIT`) และการนับอีเมลที่ไม่มีบัญชี
  เก็บในหน่วยความจำ ใช้ได้กับ backend ที่รันตัวเดียว
- ผู้ใช้หลังเครือข่ายเดียวกันใช้ IP ร่วมกัน ปรับ `AUTH_RATE_LIMIT` ตามจำนวนผู้ใช้
