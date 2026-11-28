# ผลตรวจ ERD เทียบกับขอบเขตงาน

ตรวจจากภาพ drawSQL (9 ตาราง) เทียบกับเอกสารขอบเขตงาน 12 งาน
ฐานข้อมูลใช้ **MySQL** ค่า enum ที่ยืนยันแล้ว: `work_status` (pending, in_progress, done), `review_status`
(draft, submitted, approved, returned), `action` (approve, return, revoke) กติกาอื่นดู [business-rules.md](business-rules.md)

## ส่วนที่รองรับแล้ว

บทบาท 1 คน 1 บทบาท (2.1), ประวัติการจับคู่พี่เลี้ยง (3.1, 3.2), ช่วงฝึกงาน (3.3), อีเมลและรหัสนักศึกษาไม่ซ้ำ (4.3),
ระงับบัญชี (4.1), บันทึกงานหลายรายการต่อวัน (5.1, 5.2), ไฟล์แนบหลายไฟล์ (6.1),
สถานะความคืบหน้าแยกจากสถานะตรวจ (7.1, 7.4), ผู้อนุมัติและเวลา (10.2), ความเห็นการตรวจ (8.3, 10.5),
ช่วงที่พี่เลี้ยงไม่อยู่ (10.6 บางส่วน)

## ตารางที่ขาด

| ตารางที่เสนอ | คอลัมน์หลัก | ข้อ |
|---|---|---|
| `password_reset_tokens` | id, user_id, token_hash, expires_at (30 นาที), used_at, created_at | 1.3 |
| `sessions` | id, user_id, token_hash, expires_at, created_at (ถ้าเก็บ session ใน MySQL) | 1.1, 4.1 |
| `work_list_history` | id, work_id, changed_by, changed_at, change_type, before_data (JSON), after_data (JSON), reason | 8.2, 10.4 |
| `work_status_history` | id, work_id, from_status, to_status, changed_by, changed_at | 7.2 |
| `notifications` | id, user_id, work_id, type (new_submission, overdue_review, proxy_approval), is_read, read_at, email_sent_at, created_at | 9.3 |
| `system_settings` | key, value, updated_by, updated_at (เช่น backdate_limit_days = 3, review_overdue_days = 3) | 5.6, 9.3 |

`work_status_history` รวมเข้ากับ `work_list_history` ได้โดยใช้ `change_type = 'status'`
แยกตารางจะค้นง่ายกว่า

## คอลัมน์ที่ขาดในตารางเดิม

| ตาราง | คอลัมน์ | เหตุผล | ข้อ |
|---|---|---|---|
| `users` | failed_login_count, locked_until | ล็อก 15 นาทีเมื่อผิด 5 ครั้ง | 1.2 |
| `users` | updated_at | ติดตามการแก้ไขบัญชี | 4.1 |
| `users` | must_change_password | บังคับตั้งรหัสผ่านใหม่เมื่อเข้าครั้งแรก | 1.1 |
| `users` | last_login_at | แอดมินเห็นเวลาเข้าใช้ล่าสุดและบัญชีที่ยังไม่เคยเข้าใช้ | 4.1 |
| `internships` หรือตารางเวลางานแยก | work_start_time, work_end_time, effective_from | ตรวจรายการเดิมตามเวลางาน ณ วันที่ทำงาน | 5.4 |
| `work_lists` | completed_at | เวลาที่งานเสร็จจริง | 7.3 |
| `work_lists` | time_source (ENUM timer, manual, timer_manual_end), time_edit_allowed, time_edited (BOOLEAN) | ล็อกเวลาและแสดงป้ายให้พี่เลี้ยง | 8.4 |
| `work_list_reviews` | allow_time_edit (BOOLEAN) | บันทึกว่าพี่เลี้ยงเปิดให้แก้เวลาครั้งใด | 10.5 |
| `work_lists` | version | กันอนุมัติซ้ำ หรืออนุมัติรายการที่ถูกแก้หลังตรวจ | 10.3 |
| `work_lists` | deleted_at, deleted_by, delete_reason | หน้าลบต้องกรอกเหตุผล และประวัติต้องไม่หาย | 8.2, 8.4 |
| `attachments` | uploaded_by, deleted_at, deleted_by | เปลี่ยนไฟล์แล้วยังดูข้อมูลก่อนแก้ได้ | 6.2, 8.2 |
| `work_list_reviews` | work_version | บันทึกว่าตรวจฉบับไหน | 10.3 |
| `work_list_reviews` | is_proxy, on_behalf_of_user_id, mentor_busy_id | ระบุว่าแอดมินอนุมัติแทน | 10.6 |
| `mentor_busy` | created_by, type (absent, unavailable), cancelled_at, cancelled_by | `absent` แอดมินบันทึกและเปิดสิทธิ์อนุมัติแทน `unavailable` พี่เลี้ยงบันทึกเพื่อแจ้งเท่านั้น ช่วงที่ยกเลิกไม่ลบแถว | 10.6 |
| `mentor_assignments` | assigned_by, created_at | ตรวจย้อนหลังว่าใครเปลี่ยนพี่เลี้ยง | 3.2 |
| `internships` | position, semester | หน้าจอแสดงตำแหน่งและภาคการศึกษา | หน้าจอ |
| `internships` | work_start_time, work_end_time (TIME, NOT NULL) | เวลาเข้างานและเลิกงานต่างกันตามสถานประกอบการ | 5.4 |

## ข้อกำหนด (constraint) ที่ควรมี

ใช้ MySQL 8.0.16 ขึ้นไป เพื่อให้ `CHECK` ถูกบังคับจริง และใช้ InnoDB สำหรับ transaction กับ foreign key

- `work_lists`: `work_end > work_start` และให้ `work_start`, `work_end` เป็น NULL ได้ระหว่างยังไม่เริ่มหรือยังไม่เสร็จ (5.4)
- `work_lists`: ห้ามช่วงเวลาซ้อนทับของนักศึกษาคนเดียวกันในวันเดียวกัน ไม่นับรายการที่ถูกลบ (5.7)
  MySQL ไม่มี exclusion constraint ต้องตรวจใน transaction โดยล็อกแถวนักศึกษาก่อน
  (`SELECT ... FOR UPDATE` ที่ `students_detail`) กันสองคำขอบันทึกพร้อมกัน
- เวลาสิ้นสุดต้องไม่เกิน `internships.work_end_time` ตรวจใน backend เพราะ `CHECK` อ้างตารางอื่นไม่ได้
- `mentor_assignments`: นักศึกษา 1 คนมีรายการที่ `end_date IS NULL` ได้รายการเดียว (3.1)
  MySQL ไม่มี partial unique index ใช้ generated column
  `active_student_id = IF(end_date IS NULL, student_id, NULL)` แล้วทำ `UNIQUE` (NULL ซ้ำได้)
- `internships`: `intern_end >= intern_start`
- `users.email` และ `roles.role_name` เป็น `UNIQUE` ใช้ collation แบบ `_ci` (เช่น `utf8mb4_0900_ai_ci`)
  จะไม่สนตัวพิมพ์ใหญ่เล็ก และใช้ `utf8mb4` รองรับภาษาไทย
- `before_data`, `after_data` ใช้ชนิด `JSON`
- `work_list_reviews`: ต้องมี `comment` เมื่อ action เป็นส่งกลับหรือย้อนการอนุมัติ (10.4, 10.5)
- `action` ตัด `reject` ออก เหลือ `approve`, `return`, `revoke`
- สิทธิ์ย้อนการอนุมัติให้ตามบทบาท (แอดมิน และพี่เลี้ยงของนักศึกษา) ไม่ต้องเพิ่มคอลัมน์สิทธิ์ (10.4)
- ดัชนี: `work_lists (user_id, work_date)` และ `(review_status, submitted_at)` (9.1, 9.3, 11.2)

## ข้อสังเกตด้านความสัมพันธ์

- `work_lists.user_id` ชี้ไป `users` แต่ `mentor_assignments` และ `internships` ชี้ไป `students_detail.student_id`
  ควรใช้ `student_id` ให้ตรงกัน จะได้ไม่มีรายการงานที่เจ้าของไม่ใช่นักศึกษา
- `work_lists.approved_by` และ `approved_at` ซ้ำกับ `work_list_reviews` เก็บไว้เพื่อค้นเร็วได้
  แต่ต้องอัปเดตใน transaction เดียวกัน และล้างค่าเมื่อย้อนการอนุมัติ
- งานค้างตรวจย้ายตามพี่เลี้ยงใหม่ได้เอง (3.2) ถ้าหาพี่เลี้ยงจาก `mentor_assignments` ที่ยังมีผล
  ไม่ต้องเก็บ mentor ไว้ใน `work_lists`

## เทียบกับข้อมูลที่หน้าจอใช้

| ฟิลด์ใน API | ตาราง.คอลัมน์ |
|---|---|
| `WorkLog.id`, `date` | `work_lists.work_id`, `work_date` |
| `WorkLog.startTime`, `endTime` | `work_lists.work_start`, `work_end` |
| `WorkLog.workStatus`, `reviewStatus` | `work_lists.work_status`, `review_status` |
| `Attachment.name`, `size`, `uploadedAt` | `attachments.file_name`, `file_size`, `uploaded_at` |
| `Attachment.url` | สร้างจาก `storage_path` ผ่าน endpoint ที่ตรวจสิทธิ์ (ไม่ส่ง path จริง) |
| `InternshipInfo.company`, `startDate`, `endDate` | `internships.organization_name`, `intern_start`, `intern_end` |
| `InternshipInfo.position`, `semester`, `workEndTime` | **ยังไม่มี** |
| `DailyWorklogs.mentorUnavailable` | `mentor_busy.start_busy`, `end_busy` |
| `AppNotification` | **ยังไม่มี** (`notifications`) ชนิดที่หน้าจอใช้เพิ่ม `returned`, `approved` จากรายการในตารางที่เสนอ และต้องมี `title`, `message` หรือสร้างจาก `type` กับ `work_id` |
| `HistoryEvent` | **ยังไม่ครบ** ต้องใช้ `work_list_history` ร่วมกับ `work_list_reviews` |
