# สัญญา API ระหว่าง frontend กับ backend (ฉบับร่าง)

เส้นทางและรูปแบบข้อมูลด้านล่างเป็น**ข้อเสนอจากฝั่ง frontend** ยังไม่ได้ตกลงกับ backend
ทุกหน้าเรียกข้อมูลผ่าน interface `Api` ใน [`app/services/api.ts`](../app/services/api.ts)

| ไฟล์ | หน้าที่ |
|---|---|
| `app/services/api.ts` | interface และ `ApiError` |
| `app/services/httpApi.ts` | เรียก REST จริง (แก้ไฟล์นี้เมื่อ backend กำหนดต่างจากนี้) |
| `app/services/mockApi.ts`, `mockData.ts` | ข้อมูลจำลองในหน่วยความจำ |
| `app/composables/useApi.ts` | จุดเลือกว่าจะใช้ตัวไหน |
| `app/types/worklog.ts`, `admin.ts` | ชนิดข้อมูลที่รับและส่ง (`admin.ts` = พื้นที่แอดมิน) |

Backend ใช้ **Elysia** กติกาที่ยืนยันแล้วอยู่ใน [business-rules.md](business-rules.md)
Elysia ให้บริการ REST ตามตารางด้านล่างได้โดยตรง ถ้า backend export ชนิดของแอป (`export type App`)
ให้ frontend นำเข้าได้ สามารถเปลี่ยน `httpApi.ts` ไปใช้ **Eden Treaty** (`@elysiajs/eden`)
เพื่อให้ TypeScript ตรวจเส้นทางและชนิดข้อมูลตรงกันทั้งสองฝั่ง หน้าจอไม่ต้องแก้

## การเชื่อมต่อ

สร้างไฟล์ `.env` (ดู `.env.example`) แล้วรีสตาร์ต dev server

```
NUXT_PUBLIC_API_BASE=http://localhost:4000/api
```

ถ้าไม่ตั้งค่า ระบบใช้ข้อมูลจำลอง บัญชีทดสอบอยู่ใน [`mockAccounts.ts`](../app/services/mockAccounts.ts)
ลิงก์ตั้งรหัสผ่านใหม่ของข้อมูลจำลองแสดงใน console ของเบราว์เซอร์

## การยืนยันตัวตน

| Method | Path | Body | คืนค่า |
|---|---|---|---|
| GET | `/me` | | `UserProfile` หรือ 401 |
| PATCH | `/me` | `{ firstName, lastName }` | `UserProfile` ล่าสุด |
| POST | `/auth/login` | `{ email, password, remember }` | `UserProfile` และตั้ง session cookie |
| POST | `/auth/logout` | | ไม่มี และลบ session |
| POST | `/auth/forgot-password` | `{ email }` | `{ resendAfterSeconds, expiresInMinutes }` |
| POST | `/auth/reset-password` | `{ token, newPassword }` | ไม่มี |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | ไม่มี |

ข้อผิดพลาดที่หน้าจอแยกกรณีด้วยฟิลด์ `code`

| status | code | หน้าจอ |
|---|---|---|
| 401 | `invalid_credentials` | ข้อความอีเมลหรือรหัสผ่านไม่ถูกต้อง |
| 423 | `account_locked` พร้อม `lockedUntil` (ISO 8601) | บัญชีถูกล็อกชั่วคราว |
| 403 | `account_suspended` | บัญชีถูกระงับ |
| 410 | `invalid_token` | ลิงก์ใช้ไม่ได้ |
| 422 | `wrong_password` | รหัสผ่านปัจจุบันไม่ถูกต้อง |
| 403 | (ไม่มี) ที่ endpoint ข้อมูล | เข้าถึงรายการนี้ไม่ได้ |

ลิงก์ในอีเมลรีเซ็ตรหัสผ่านชี้มาที่ `/reset-password?token=...`

backend ต้องทำเอง

- เก็บรหัสผ่านเป็น hash และเก็บ token รีเซ็ตเป็น hash ใช้ได้ครั้งเดียว อายุ 30 นาที
- ล็อก 15 นาทีเมื่อผิด 5 ครั้ง (1.2) และจำกัดอัตราการเรียก `/auth/*` ตาม IP
- `forgot-password` ตอบเหมือนกันทุกอีเมล ไม่เปิดเผยว่ามีบัญชีหรือไม่
- ตอบ `account_suspended` หลังตรวจรหัสผ่านถูกแล้วเท่านั้น และตัด session ทันทีเมื่อระงับบัญชี (4.1)
- session cookie เป็น `HttpOnly`, `Secure`, `SameSite` และป้องกัน CSRF
- ตัด session อื่นเมื่อเปลี่ยนหรือรีเซ็ตรหัสผ่าน
- `PATCH /me` แก้ได้เฉพาะชื่อและนามสกุลของผู้ใช้ใน session ตัดช่องว่างหัวท้าย ห้ามว่างและยาวไม่เกิน 50 ตัวอักษร ผิดตอบ 422
- `UserProfile` มี `firstName`, `lastName` และ `name` (สองค่าต่อกันด้วยช่องว่าง) เซิร์ฟเวอร์กำหนด `name` และ `initials` เอง
- ชื่อที่แสดงในรายการ ประวัติ และรายงาน ต้องอ้างอิงจากผู้ใช้ ไม่คัดลอกเก็บแยก

## รูปแบบข้อมูล

- วันที่ `YYYY-MM-DD` (ค.ศ.) เวลา `HH:MM` วันเวลา ISO 8601 การแสดง พ.ศ. ทำที่หน้าจอ
- ชื่อฟิลด์เป็น camelCase
- `workStatus`: `pending` | `in_progress` | `done`
- `reviewStatus`: `draft` | `submitted` | `returned` | `approved`
- ข้อผิดพลาด: HTTP status พร้อม `{ "message": "ข้อความภาษาไทยที่แสดงให้ผู้ใช้ได้" }`
- การยืนยันตัวตน: session cookie (`credentials: include`)
- ถ้า backend อยู่คนละ origin ต้องตั้ง CORS ให้อนุญาต credentials และพิจารณาป้องกัน CSRF

## Endpoint

| Method | Path | คืนค่า | ใช้ที่หน้า |
|---|---|---|---|
| GET | `/me/dashboard` | `StudentDashboard` | หน้าหลัก |
| GET | `/me/internship` | `InternshipInfo` | ข้อมูลสถานที่ฝึกงาน |
| GET | `/me/worklogs/daily?date=` | `DailyWorklogs` | บันทึกงานประจำวัน |
| GET | `/me/worklogs?from=&to=` | `WorkLog[]` พร้อม `canEdit` | บันทึกย้อนหลัง (ชั่วโมงรวม, เวลาซ้อน), ปฏิทินรายสัปดาห์ (รายวันใช้ `daily`) |
| GET | `/me/worklogs/:id` | `WorkLog` พร้อม `attachments` และ `canEdit` | แก้ไขและส่งตรวจใหม่ |
| GET | `/me/worklogs/form-context?mode=new\|backdate` | `WorklogFormContext` | ฟอร์มบันทึกงาน |
| GET | `/time` | `{ "now": ISO 8601 }` | ปุ่มทำงานเสร็จสิ้น |
| POST | `/me/worklogs` | `WorkLog` | สร้างรายการ |
| PUT | `/me/worklogs/:id` | `WorkLog` | แก้ไข / ส่งตรวจ |
| POST | `/me/worklogs/:id/start` | `WorkLog` บันทึกวันที่และเวลาเริ่มจากเซิร์ฟเวอร์ | หน้าหลัก |
| POST | `/me/worklogs/:id/finish` | `WorkLog` บันทึกเวลาสิ้นสุดจากเซิร์ฟเวอร์ | หน้าหลัก |
| DELETE | `/me/worklogs/:id` body `{ reason }` | ไม่มี | ลบรายการ |
| GET | `/me/worklogs/:id/history` | `WorklogHistory` | ประวัติการแก้ไข |
| GET | `/me/reports/weekly?weekStart=` | `WeeklyReportData` | รายงานของนักศึกษา |
| GET | `/mentor/students` | `MentorStudent[]` | รายงานของพี่เลี้ยง |
| GET | `/mentor/reports/weekly?weekStart=&studentId=` | `WeeklyReportData[]` | รายงานของพี่เลี้ยง |
| GET | `/mentor/students/overview` | `SupervisedStudents` | นักศึกษาในความดูแล |
| GET | `/mentor/reviews?filter=pending\|all&limit=&studentId=` | `ReviewQueue` (กรองรายคนได้ ถ้าไม่อยู่ในความดูแลตอบ 403) | ตรวจงานนักศึกษา |
| POST | `/mentor/reviews/approve` body `{ items: [{ id, version }], comment? }` | `ReviewResult` | ตรวจงานนักศึกษา |
| POST | `/mentor/reviews/return` body `{ items: [{ id, version }], comment, allowTimeEdit? }` | `ReviewResult` | ตรวจงานนักศึกษา |
| POST | `/mentor/unavailability` body `{ date, startTime, endTime, reason }` | ไม่มี | ตารางเวลาไม่สะดวก |

`/me/worklogs/:id/history` เรียกได้ทั้งนักศึกษาเจ้าของรายการ และพี่เลี้ยงของนักศึกษานั้น
`GET /time` เรียกได้ทุกบทบาทที่เข้าสู่ระบบ

## การล็อกเวลา (กติกาสำหรับ backend)

ดูตารางใน [business-rules.md](business-rules.md) หน้าจอล็อกช่องเพื่อช่วยผู้ใช้เท่านั้น backend ต้องบังคับเอง

- `PUT /me/worklogs/:id` ที่แก้ช่องเวลาซึ่งล็อกอยู่ ตอบ 409
- `WorkLog.timeSource` (`timer` | `manual` | `timer_manual_end`), `timeEditAllowed`, `timeEdited` เซิร์ฟเวอร์เป็นผู้กำหนด ห้ามรับจาก client
- รายการจากฟอร์มใหม่ เซิร์ฟเวอร์ควรบันทึกเวลาเริ่มตอนเปิดฟอร์ม และเวลาสิ้นสุดตอนกดเสร็จสิ้นไว้เอง
  สัญญาปัจจุบันให้ client ส่งค่ากลับมา ข้อมูลจำลองตรวจได้เพียงว่าเป็นวันนี้และไม่เกินเวลาปัจจุบัน
  แนะนำเพิ่ม endpoint เริ่มและจบงาน เช่น `POST /me/worklogs/start`, `POST /me/worklogs/:id/finish`
- ส่งตรวจใหม่หรืออนุมัติแล้ว ล้าง `timeEditAllowed`

## หน้าหลัก

`GET /me/dashboard` คำนวณ `summary` จากรายการทั้งหมดของนักศึกษา และ `recentWorklogs` เรียงใหม่สุดก่อน
ปัจจุบันส่งทุกรายการให้หน้าจอกรองและแบ่งแสดงทีละ 10 ถ้าข้อมูลมากให้เพิ่มการแบ่งหน้าฝั่งเซิร์ฟเวอร์

## การตรวจงาน (กติกาสำหรับ backend)

- พี่เลี้ยงเห็นและตรวจได้เฉพาะนักศึกษาในความดูแล และไม่เห็นฉบับร่าง (9.2)
- อนุมัติได้เฉพาะรายการสถานะ `submitted` และ `version` ตรงกับที่ผู้ตรวจเห็น ไม่ตรงให้รายการนั้นไม่สำเร็จ (10.3)
- อนุมัติหลายรายการ ตอบแยกว่ารายการใดสำเร็จและไม่สำเร็จ (`succeededIds`, `failures`) (10.1)
- บันทึกผู้อนุมัติ วันเวลา และประวัติใน transaction เดียวกัน (10.2)
- ส่งกลับต้องมีความคิดเห็น (10.5)
- เพิ่ม `version` ทุกครั้งที่บันทึกหรือเปลี่ยนสถานะตรวจ
- `pendingDays`, `isOverdue` คำนวณจากเวลาเซิร์ฟเวอร์ `items` แบบรอตรวจเรียงเก่าสุดก่อน (9.3)

`POST` และ `PUT` ส่งเป็น `multipart/form-data`: ฟิลด์ `data` เป็น JSON ของ `SaveWorklogInput`
(ไม่รวม `id` และ `newFiles`) และ `files` เป็นไฟล์ใหม่ ไฟล์เดิมที่ไม่อยู่ใน `keepAttachmentIds` ถือว่าถูกลบ

## สิ่งที่ backend ต้องตรวจเอง

หน้าจอตรวจเพื่อช่วยผู้ใช้เท่านั้น backend ต้องบังคับใช้ทุกข้อ

- สิทธิ์ตามบทบาท นักศึกษาเห็นเฉพาะของตนเอง พี่เลี้ยงเห็นเฉพาะนักศึกษาในความดูแล (2.3, 9.2)
- พี่เลี้ยงไม่เห็นรายการฉบับร่าง
- ข้อมูลจำเป็นครบ และเวลาสิ้นสุดมากกว่าเวลาเริ่ม (5.4)
- เวลาเริ่มไม่ก่อนเวลาเข้างานและก่อนเวลาเลิกงาน เวลาสิ้นสุดไม่เกินเวลาเลิกงานของวันเดียวกัน
- รายการของวันนี้ เวลาเริ่มและเวลาสิ้นสุดต้องไม่เกินเวลาเซิร์ฟเวอร์ ทุกเส้นทางที่บันทึกเวลา (ตอบ 422)
  ส่วนการส่งตรวจทำได้ทุกเวลา
- เวลาไม่ซ้อนทับกับรายการอื่นของนักศึกษาในวันเดียวกัน ตอบ 409 (5.7) ควรบังคับใน transaction
- อยู่ในช่วงฝึกงานและช่วงย้อนหลังที่อนุญาต (5.6) รายการที่ถูกส่งกลับคงวันเดิมได้แม้เก่ากว่าช่วงย้อนหลัง
- กำหนดแก้ไข: ฉบับร่างนับจากวันที่ทำงาน รายการที่ถูกส่งกลับนับจากวันที่ของ `reviewedAt` (เวลาไทย)
  บวกจำนวนวันย้อนหลัง เลยกำหนดแล้วแก้ไขไม่ได้ ตอบ 409 และส่ง `canEdit: false` (ยังลบได้)
- ฉบับร่างไม่มี `startTime`, `endTime` ได้ แต่ส่งตรวจต้องมีครบ และมี `endTime` โดยไม่มี `startTime` ไม่ได้
- ชนิดและขนาดไฟล์ ตรวจจากเนื้อไฟล์ด้วย ไม่ใช่นามสกุลอย่างเดียว (6.1)
- แก้ไข/ลบได้เฉพาะฉบับร่างหรือถูกส่งกลับ (8.4)
- การลบเป็น soft delete: เก็บผู้ลบ เวลา เหตุผล และเพิ่มประวัติ `type: delete` รายการที่ลบแล้วไม่อยู่ในรายการ
  รายงาน ชั่วโมงรวม และการตรวจเวลาซ้อน และเรียก `GET`, `PUT` ตามปกติไม่ได้ (404)
- `ReviewQueue.deletedReturns` คือรายการของนักศึกษาในความดูแลที่ถูกลบขณะสถานะส่งกลับแก้ไข ส่งทุก `filter`
- ประวัติของรายการที่ลบแล้ว (พร้อม `worklog.deletion`) เจ้าของเรียกได้ พี่เลี้ยงเรียกได้เฉพาะรายการที่เคยถูกส่งกลับ
- ลิงก์ไฟล์แนบต้องตรวจสิทธิ์ก่อนให้ดูหรือดาวน์โหลด
- เวลาเริ่มของรายการใหม่คือเวลาเซิร์ฟเวอร์ตอนเปิดฟอร์ม (`form-context?mode=new` คืน `defaults.startTime`)
  เซิร์ฟเวอร์ไม่ควรเชื่อค่าที่ client ส่งกลับมาโดยไม่ตรวจ
- เวลาเข้างานและเลิกงานต่างกันตามสถานประกอบการ backend อ่านจากข้อมูลการฝึกงานของผู้ใช้
  ส่ง `workStartTime`, `workEndTime` (`HH:MM`) ใน `InternshipInfo` และ `WorklogFormContext`
- ร่างที่ระบบจับเวลาและยังไม่มีเวลาสิ้นสุด แก้ `endTime` ผ่าน `PUT` ได้เมื่อเลยเวลาเลิกงานของวันนั้นหรือข้ามวันแล้ว
  ครั้งเดียว และตั้ง `timeSource = timer_manual_end` ตัดสินจากเวลาเซิร์ฟเวอร์
- `GET /time` ใช้ให้หน้าจอรู้ว่าเลยเวลาเลิกงานแล้ว

## การอนุมัติแทน (กติกาสำหรับ backend)

- ช่วงที่พี่เลี้ยงไม่อยู่มี 2 ประเภท `absent` และ `unavailable` ดู [business-rules.md](business-rules.md)
- ตอนแอดมินอนุมัติ ตรวจจากเวลาเซิร์ฟเวอร์ว่ามีช่วง `absent` ของพี่เลี้ยงที่ครอบคลุมเวลานั้น ถ้าไม่มีตอบ 403
- แอดมินส่งกลับแก้ไขแทนพี่เลี้ยงไม่ได้
- `DailyWorklogs.mentorUnavailable` ยังไม่มีประเภทและวันที่ จะกำหนดพร้อมหน้าตารางเวลาไม่สะดวก

## แอดมิน

ทุก endpoint ใต้ `/admin` เรียกได้เฉพาะแอดมิน บทบาทอื่นตอบ 403

### ตั้งค่าระบบ

| Method | Path | Body | คืนค่า |
|---|---|---|---|
| GET | `/admin/settings` | | `SystemSettings` |
| PUT | `/admin/settings` | `{ backdateLimitDays, reviewOverdueDays }` | `SystemSettings` ล่าสุด |

- สองค่าที่แก้ได้เป็นจำนวนเต็ม 1–30 ผิดตอบ 422
- `maxFailedLogins` และ `lockMinutes` อ่านได้อย่างเดียว
- เซิร์ฟเวอร์กำหนด `updatedAt`, `updatedBy`
- ค่าใหม่มีผลทันทีกับ `backdateLimitDays` ใน `WorklogFormContext`, `canEdit`, การตรวจตอนบันทึก,
  `overdueDays`, `isOverdue` และการแจ้งเตือนค้างตรวจ การแจ้งเตือนที่ส่งไปแล้วไม่ถอนคืน

## ยังไม่มีในสัญญานี้

หน้าจอเหล่านี้ยังไม่ได้ทำ จึงยังไม่กำหนด endpoint: จัดการบัญชีและนำเข้า Excel,
กำหนดพี่เลี้ยง, ย้อนการอนุมัติ, การแจ้งเตือนทางอีเมลและของแอดมิน, ปฏิทินของพี่เลี้ยงและแอดมิน

## การแจ้งเตือนในระบบ

| Method | Path | Body | คืนค่า |
|---|---|---|---|
| GET | `/notifications` | | `AppNotification[]` ของผู้ที่เข้าสู่ระบบ ใหม่สุดก่อน |
| POST | `/notifications/read` | `{ ids? }` ไม่ระบุ = ทุกรายการของตน | ไม่มี |

ชนิดข้อมูลอยู่ใน [`app/types/notification.ts`](../app/types/notification.ts)

backend ต้องทำเอง

- ส่งเฉพาะการแจ้งเตือนของผู้ใช้นั้น และให้ทำเครื่องหมายได้เฉพาะของตน
- พี่เลี้ยง: `new_submission` เมื่อนักศึกษาในความดูแลส่งตรวจ และ `overdue_review` ครั้งเดียวต่อรายการเมื่อรอตรวจเกินกำหนด (9.3)
- นักศึกษา: `returned` และ `approved` เมื่อพี่เลี้ยงตรวจ
- `canEdit` ใช้กับ `returned` บอกว่ายังเปิดหน้าแก้ไขได้ ไม่ได้ส่งหรือเป็น `false` หน้าจอเปิดหน้าประวัติ
- `title` และ `message` เป็นข้อความภาษาไทยพร้อมแสดง
- หน้าจอโหลดรายการเมื่อเปิดหน้าและเมื่อเปิดแผง ยังไม่มีการส่งแบบ real-time


## เริ่มและจบงานจากหน้าหลัก

- ทำได้เฉพาะฉบับร่างของตนเองที่ยังไม่เลยกำหนดแก้ไข
- เริ่มงาน: เฉพาะรายการที่ยังไม่มีเวลาเริ่ม อยู่ในเวลางาน และไม่มีงานอื่นของวันนี้ที่กำลังดำเนินการ
  วันที่ของรายการเปลี่ยนเป็นวันนี้ และ `timeSource = timer`
- จบงาน: เฉพาะรายการของวันนี้ เวลาสิ้นสุดมากกว่าเวลาเริ่ม ไม่เกินเวลาเลิกงาน และไม่ซ้อนกับรายการอื่น
- บันทึกประวัติการเปลี่ยนสถานะและเวลา (7.2, 7.3)
- จับเวลาได้ครั้งละหนึ่งงาน ต้องบังคับที่ `start`, `POST` และ `PUT` ด้วย (ตอบ 409) และควรตรวจใน transaction
  รายการของวันนี้ที่เวลาสิ้นสุดเลยเวลาเริ่มของงานที่จับเวลาอยู่ ถือว่าซ้อนทับ
- `form-context` ส่ง `runningWorklog` เมื่อมีงานของวันนี้ที่ยังไม่เสร็จ

การแก้ไขรายการ (`PUT`) backend ต้องบันทึกประวัติข้อมูลก่อนและหลังทุกครั้ง (8.2)
