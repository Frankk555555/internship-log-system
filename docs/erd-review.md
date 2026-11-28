# การออกแบบฐานข้อมูล

ปรับจาก ERD เดิม (drawSQL 9 ตาราง) ให้ครบตามขอบเขตงาน [business-rules.md](business-rules.md) และ [api-contract.md](api-contract.md)
ตัว schema อยู่ใน [`backend/db/schema.sql`](../backend/db/schema.sql) ถ้าเอกสารนี้ขัดกับไฟล์นั้น ให้ยึดไฟล์

## การติดตั้ง

ต้องใช้ MySQL 8.0.16 ขึ้นไป หรือ MariaDB 10.4 ขึ้นไป (รุ่นเก่ากว่านี้ไม่บังคับ `CHECK`)
สร้างฐานข้อมูลเปล่าแล้วรันไฟล์ ถ้ามีตารางอยู่แล้วไฟล์จะหยุดด้วยข้อผิดพลาด ไม่ลบหรือเขียนทับข้อมูล

```sql
CREATE DATABASE internship_log CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE internship_log;
SOURCE backend/db/schema.sql;
```

ไฟล์ใส่เฉพาะข้อมูลที่ระบบต้องมี คือ 3 บทบาทและค่าตั้งต้นของระบบ **ไม่มีบัญชีผู้ใช้** บัญชีแอดมินคนแรกต้องสร้างด้วยสคริปต์ของ backend

ทดสอบแล้ว (28 พ.ย. 2569) บน MySQL 8.4.13, MySQL 8.0.46 และ MariaDB 10.4.32 รุ่นอื่นยังไม่ได้ทดสอบ

## ตาราง

| ตาราง | เก็บอะไร | ที่มา |
|---|---|---|
| `roles` | บทบาท `student`, `supervisor`, `admin` | เดิม |
| `users` | บัญชี รหัสผ่านแบบ hash การล็อกและระงับ | เดิม ปรับ |
| `students_detail` | ข้อมูลนักศึกษา | เดิม |
| `sessions` | session ที่เข้าสู่ระบบอยู่ | ใหม่ |
| `password_reset_tokens` | ลิงก์รีเซ็ตและลิงก์ตั้งรหัสครั้งแรก | ใหม่ |
| `internships` | สถานประกอบการ ตำแหน่ง ช่วงฝึก | เดิม ปรับ |
| `internship_work_hours` | เวลาเข้าและเลิกงานตามวันเริ่มมีผล | ใหม่ |
| `mentor_assignments` | ใครเป็นพี่เลี้ยงของใคร พร้อมประวัติ | เดิม ปรับ |
| `mentor_busy` | ช่วงพี่เลี้ยงไม่อยู่และไม่สะดวกตรวจ | เดิม ปรับ |
| `work_lists` | รายการงาน | เดิม ปรับ |
| `attachments` | ไฟล์แนบ | เดิม ปรับ |
| `work_list_reviews` | การอนุมัติ ส่งกลับ ย้อนการอนุมัติ อนุมัติแทน | เดิม ปรับ |
| `work_list_history` | เส้นเวลาของรายการ | ใหม่ |
| `notifications` | การแจ้งเตือนในระบบและสถานะส่งอีเมล | ใหม่ |
| `notification_members` | นักศึกษาในการแจ้งเตือนแบบรวม | ใหม่ |
| `system_settings` | ค่าตั้งของระบบ (แถวเดียว) | ใหม่ |
| `user_imports`, `user_import_rows` | ผลตรวจไฟล์ Excel และประวัติการนำเข้า | ใหม่ |

## ส่วนที่ต่างจาก ERD เดิม

| เรื่อง | เดิม | ปัจจุบัน | เหตุผล |
|---|---|---|---|
| ชื่อผู้ใช้ | `users.full_name` | `first_name`, `last_name` | หน้าจอและแบบฟอร์ม Excel แยกสองช่อง |
| เจ้าของรายการงาน | `work_lists.user_id` | `work_lists.student_id` | ตรงกับตารางฝึกงานและพี่เลี้ยง และกันเจ้าของที่ไม่ใช่นักศึกษา |
| ข้อมูลฝึกงาน | หลายแถวต่อคนได้ | **1 แถวต่อนักศึกษา** | หน้าจอมีได้ชุดเดียว ถ้าต้องเก็บหลายภาคการศึกษา ให้ถอด `uq_internships_student` |
| `internships` | | เพิ่ม `position`, `semester` | หน้าจอแสดง |
| เวลางาน | ไม่มี | ตาราง `internship_work_hours` | เปลี่ยนเวลางานแล้วรายการเก่าต้องตรวจตามเวลาเดิม |
| `action` การตรวจ | มี `reject` | `approve`, `return`, `revoke` | ไม่มีสถานะปฏิเสธ |
| ประวัติสถานะ | เคยเสนอแยก `work_status_history` | รวมใน `work_list_history` (`change_type = 'status'`) | หน้าประวัติอ่านตารางเดียว |
| ค่าตั้งของระบบ | เคยเสนอแบบ key/value | แถวเดียว คอลัมน์ละค่า | บังคับชนิดและช่วง 1–30 ได้ |
| สถานะอ่านแจ้งเตือน | เคยเสนอ `is_read` และ `read_at` | `read_at` อย่างเดียว (`NULL` = ยังไม่อ่าน) | ไม่ให้สองค่าขัดกัน |
| ชนิดเวลา | `timestamp` | `DATETIME` เก็บ UTC | ใช้แบบเดียวกันทุกตาราง และไม่ติดเพดานปี 2038 |

`phone`, `faculty`, `major` จาก ERD เดิมยังเก็บไว้ (เว้นว่างได้) ปัจจุบันยังไม่มีหน้าจอใช้

## การตั้งค่าการเชื่อมต่อ (backend ต้องทำทุกการเชื่อมต่อ)

- `SET time_zone = '+00:00'` ค่า `DATETIME` และ `CURRENT_TIMESTAMP` จะเป็น UTC
- `SET sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'`
  MariaDB ของ XAMPP ไม่เปิดโหมดเข้มงวด ข้อความยาวเกินจะถูกตัด และ enum ผิดจะกลายเป็นค่าว่างโดยไม่แจ้ง
- ให้ตัวเชื่อมต่อคืน `DATE`, `TIME`, `DATETIME` เป็นข้อความ แล้วแปลงเอง ป้องกันวันที่เลื่อนจากการแปลงโซนเวลา
- `work_date`, `work_start`, `work_end`, `intern_*`, `effective_from`, `start_date`, `end_date` เป็นวันและเวลาไทย
  "วันนี้" และการเทียบเวลาปัจจุบันต้องแปลงเวลาเซิร์ฟเวอร์เป็นเวลาไทยก่อน
- คอลัมน์ `TIME` คืน `HH:MM:SS` ส่วน API ใช้ `HH:MM`
- คอลัมน์ `JSON` บน MariaDB คืนเป็นข้อความ ต้องแปลงเอง

## กติกาที่ฐานข้อมูลบังคับ

- อีเมลไม่ซ้ำแบบไม่สนตัวพิมพ์ รหัสนักศึกษาไม่ซ้ำ นักศึกษา 1 บัญชีมีข้อมูล 1 แถว
- พี่เลี้ยงปัจจุบันได้คนเดียวต่อนักศึกษา
- วันสิ้นสุดฝึกงานหลังวันเริ่ม เวลาเลิกงานหลังเวลาเข้างาน เวลาสิ้นสุดงานหลังเวลาเริ่ม
- `work_status` ตรงกับเวลาที่มี ส่งตรวจได้เมื่อเสร็จแล้ว
- อนุมัติต้องมีผู้อนุมัติและเวลา สถานะอื่นต้องไม่มี
- ลบแบบเก็บข้อมูล ต้องมีผู้ลบ เวลา เหตุผล และเฉพาะฉบับร่างหรือถูกส่งกลับ
- รายการที่ระบบจับเวลาและยังไม่จบ มีได้รายการเดียวต่อนักศึกษาต่อวัน
- ส่งกลับและย้อนการอนุมัติต้องมีความคิดเห็น
- อนุมัติแทนต้องระบุพี่เลี้ยงและช่วงไม่อยู่ของพี่เลี้ยงคนนั้น และใช้กับการอนุมัติเท่านั้น
- ไฟล์แนบไม่เกิน 5 MB
- ยกเลิกได้เฉพาะช่วง `absent` และต้องมีผู้ยกเลิก
- การแจ้งเตือนแบบครั้งเดียวไม่ซ้ำ (`user_id` + `dedupe_key`)
- วันย้อนหลังและวันค้างตรวจ 1–30
- แถวที่ประวัติอ้างถึงลบไม่ได้

## กติกาที่ backend ต้องบังคับเอง

ฐานข้อมูลตรวจสิ่งเหล่านี้ไม่ได้ เพราะต้องเทียบหลายแถว หลายตาราง หรือเวลาปัจจุบัน
รายการสิทธิ์และเงื่อนไขทั้งหมดอยู่ใน [api-contract.md](api-contract.md)

| เรื่อง | สิ่งที่ต้องทำ |
|---|---|
| บทบาทของผู้ถูกอ้าง | `mentor_user_id` และ `mentor_busy.user_id` ต้องเป็นพี่เลี้ยง `students_detail.user_id` ต้องเป็นนักศึกษา |
| เวลาซ้อน (5.7) | ล็อกนักศึกษาก่อน (ดูด้านล่าง) |
| จับเวลาครั้งละหนึ่งงาน | ฐานข้อมูลกันเฉพาะ `time_source = 'timer'` ร่างวันนี้ที่กรอกเวลาเริ่มเองโดยไม่มีเวลาสิ้นสุดต้องตรวจเพิ่ม |
| เวลางาน ช่วงฝึกงาน ย้อนหลัง เวลาอนาคต | ใช้เวลางานแถวล่าสุดที่ `effective_from` ไม่เกินวันที่ทำงาน ไม่มีแถวก่อนหน้าให้ใช้แถวแรก |
| การล็อกเวลา | ตามตารางใน business-rules.md `time_source` และธงต่าง ๆ ห้ามรับจาก client |
| ส่งตรวจ | ต้องมีไฟล์แนบที่ยังไม่ถูกลบอย่างน้อย 1 ไฟล์ |
| ช่วงไม่อยู่ซ้อนกัน | ล็อกแถวพี่เลี้ยงใน `users` แล้วตรวจช่วงประเภทเดียวกันที่ไม่ถูกยกเลิก |
| อนุมัติแทน | เวลาปัจจุบันต้องอยู่ในช่วง `absent` และพี่เลี้ยงคนนั้นต้องดูแลนักศึกษาอยู่ |
| ประวัติ | เพิ่มแถวใน transaction เดียวกับการแก้ข้อมูล ห้าม `UPDATE`/`DELETE` ใน `work_list_history` และ `work_list_reviews` |
| ความยาวข้อความ | ชื่อและนามสกุลไม่เกิน 50 (คอลัมน์รับ 100) รหัสนักศึกษาเป็นเลข 8–20 หลัก ทั้งสองข้อยังเป็นข้อสมมติจึงไม่ใส่ในฐานข้อมูล หัวข้องานไม่เกิน 255 |
| งานล้างข้อมูล | ลบ session และ token ที่หมดอายุ และ `user_imports` ที่หมดอายุโดยยังไม่ยืนยัน |

### รูปแบบ transaction ที่สำคัญ

**บันทึกเวลา** คำสั่งแรกของ transaction ต้องเป็นการล็อก ถ้าอ่านแบบไม่ล็อกก่อน จะเห็นข้อมูลชุดเก่า

```sql
START TRANSACTION;
SELECT student_id FROM students_detail WHERE student_id = ? FOR UPDATE;
SELECT work_id FROM work_lists
 WHERE student_id = ? AND work_date = ? AND deleted_at IS NULL AND work_id <> ?
   AND work_start < ?  /* เวลาสิ้นสุดใหม่ ยังไม่มีให้ใช้เวลาเริ่มใหม่บวก 1 นาที */
   AND work_end > ?;   /* เวลาเริ่มใหม่ */
-- ไม่พบรายการซ้อนจึงบันทึก
COMMIT;
```

คำค้นนี้ตรงกับ `findOverlaps` ใน [`worklogRules.ts`](../app/utils/worklogRules.ts) คือนับเฉพาะรายการที่มีเวลาครบ
ส่วนงานของวันนี้ที่ยังจับเวลาอยู่ตรวจแยก: รายการอื่นของวันนี้ที่เวลาสิ้นสุดเลยเวลาเริ่มของงานนั้นถือว่าซ้อน
ต้องตรวจภายใต้การล็อกเดียวกัน

**ตรวจงาน** ใส่เวอร์ชันที่ผู้ตรวจเห็นในเงื่อนไข ได้ 0 แถวแปลว่ารายการนั้นไม่สำเร็จ (10.3)

```sql
UPDATE work_lists
   SET review_status = 'approved', approved_by = ?, approved_at = UTC_TIMESTAMP(), version = version + 1
 WHERE work_id = ? AND version = ? AND review_status = 'submitted' AND deleted_at IS NULL;
-- สำเร็จ 1 แถว: เพิ่ม work_list_reviews, work_list_history, notifications แล้ว COMMIT
```

**ย้อนการอนุมัติ** (10.4) รายการกลับเป็น `submitted` ล้าง `approved_by`, `approved_at` เพิ่ม `version`
เพิ่มแถวตรวจ `revoke` พร้อมความคิดเห็น และประวัติ `revoke` โดยคง `submitted_at` เดิม

**เปลี่ยนพี่เลี้ยง** ปิดแถวเดิมด้วย `end_date` แล้วเพิ่มแถวใหม่ งานรอตรวจตามไปเองเพราะหาพี่เลี้ยงจากแถวปัจจุบัน
การแจ้งเตือนต้องย้าย `user_id` ของแถวที่ `work_id` เป็นของนักศึกษาคนนั้นจากคนเดิมไปคนใหม่ (ไม่ย้ายของนักศึกษา)

**นำเข้าผู้ใช้** ยืนยันด้วย `UPDATE user_imports SET imported_at = ... WHERE import_id = ? AND imported_at IS NULL`
ได้ 0 แถวตอบ 409 แล้วสร้างบัญชีใน transaction เดียวกัน

## การเขียนข้อมูลลงบางตาราง

- `work_list_history.before_data`, `after_data` เก็บเฉพาะค่าที่เปลี่ยน ใช้ชื่อเดียวกับ API:
  `date`, `startTime`, `endTime`, `title`, `description`, `attachments` (รายชื่อไฟล์), `workStatus`, `reviewStatus`
  ข้อความ `title`, `before`, `after` ที่หน้าจอแสดง backend สร้างจากค่าเหล่านี้
- เหตุการณ์ `return`, `approval`, `revoke` มี `review_id` เสมอ ความเห็นและข้อมูลอนุมัติแทนอ่านจากแถวตรวจ
- `notifications.dedupe_key`: `overdue:{work_id}`, `absent:{busy_id}`, `no_mentor`
  ชนิดอื่นเป็น `NULL` เรื่องของแอดมินที่จัดการแล้วให้ลบแถว สถานะอ่านแยกตามผู้รับอยู่แล้ว
- การแจ้งเตือน `no_mentor`: ถ้ามีนักศึกษาที่ไม่อยู่ใน `notification_members` ให้ล้าง `read_at` และปรับ `created_at`
- `users.password_hash` เป็น `NULL` สำหรับพี่เลี้ยงและแอดมินที่ยังไม่ตั้งรหัส นักศึกษาใหม่เก็บ hash ของรหัสนักศึกษา และ `must_change_password = TRUE`

## เทียบกับข้อมูลที่หน้าจอใช้

| ฟิลด์ใน API | มาจาก |
|---|---|
| `studentId` (ทุกที่) | `students_detail.student_code` ไม่ใช่ `students_detail.student_id` |
| `UserProfile.role` | `roles.role_name` |
| `name` | `first_name`, `last_name` ต่อกันด้วยช่องว่าง |
| `AdminUser.status` | `is_active = FALSE` → `suspended`, ไม่เช่นนั้น `locked_until` ยังไม่ถึง → `locked`, นอกนั้น `active` |
| `InternshipInfo.company`, `startDate`, `endDate` | `organization_name`, `intern_start`, `intern_end` |
| `InternshipInfo.mentorName`, `hasMentor` | `mentor_assignments` แถวที่ `end_date IS NULL` |
| `InternshipInfo.progress` | คำนวณจากวันนี้ |
| `AdminOverview.semester` | `system_settings.current_semester` |
| `WorkLog.id`, `date`, `startTime`, `endTime` | `work_id`, `work_date`, `work_start`, `work_end` |
| `WorkLog.reviewComment`, `reviewedBy`, `reviewedAt`, `proxyFor` | แถวตรวจล่าสุด เฉพาะเมื่อสถานะ `returned` หรือ `approved` |
| `WorkLog.canEdit` | คำนวณจากสถานะ วันที่ และค่าย้อนหลัง |
| `WorkLog.deletion` | `deleted_at`, `deleted_by`, `delete_reason` |
| `Attachment.name`, `size`, `uploadedAt` | `file_name`, `file_size`, `uploaded_at` |
| `Attachment.url` | endpoint ที่ตรวจสิทธิ์ก่อนอ่าน `storage_path` |
| `ReviewItem.pendingDays`, `isOverdue` | คำนวณจาก `submitted_at` (นับวันตามปฏิทินไทย) |
| `MentorAbsence.startAt`, `endAt`, `cancelled` | `start_busy`, `end_busy`, `cancelled_at`, `cancelled_by` |
| `MentorAbsence.status`, `proxyApprovalCount` | คำนวณจากเวลา และนับแถวตรวจที่อ้าง `mentor_busy_id` |
| `AppNotification.title` | สร้างจาก `type` |
| `AppNotification.isRead`, `studentId`, `mentorId`, `canEdit` | `read_at`, เจ้าของ `work_id`, ผู้ใช้ของ `mentor_busy_id`, คำนวณ |
| `SystemSettings.updatedBy` | ชื่อของ `system_settings.updated_by` |
| `ImportRow.row`, `roleText` | `sheet_row`, `role_text` |

## ยังรอตัดสินใจ

1. **อายุลิงก์ตั้งรหัสครั้งแรก** ของพี่เลี้ยงและแอดมินใหม่ กำหนดไว้เฉพาะลิงก์รีเซ็ต (30 นาที) ซึ่งอาจสั้นเกินสำหรับบัญชีใหม่
2. **ค้างตรวจหลังย้อนการอนุมัติ** เมื่อคง `submitted_at` เดิม รายการอาจขึ้นค้างตรวจทันที
3. **ประเภท `revoke` ในหน้าประวัติ** `HistoryEvent.type` ของ frontend ยังไม่มี ต้องเพิ่มตอนทำหน้าย้อนการอนุมัติ
