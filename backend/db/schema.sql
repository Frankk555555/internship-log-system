-- ฐานข้อมูลระบบบันทึกการฝึกงาน
-- ใช้ได้กับ MySQL 8.0.16 ขึ้นไป และ MariaDB 10.4 ขึ้นไป (ต้องบังคับ CHECK ได้จริง)
-- รันในฐานข้อมูลเปล่าเท่านั้น คำอธิบายและกติกาที่ backend ต้องบังคับเองอยู่ใน docs/erd-review.md
--
-- เวลา
--   คอลัมน์ DATETIME ทุกคอลัมน์เก็บเป็น UTC  การเชื่อมต่อต้องตั้ง time_zone = '+00:00'
--   คอลัมน์ DATE และ TIME (work_date, work_start, intern_start ฯลฯ) เป็นวันและเวลาไทย
-- โหมดเข้มงวด
--   การเชื่อมต่อต้องตั้ง sql_mode แบบเข้มงวดตามบรรทัดล่าง ถ้าไม่ตั้ง ค่าที่ยาวเกินหรือ enum ผิดจะถูกตัดทิ้งเงียบ ๆ

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ---------------------------------------------------------------------------
-- ผู้ใช้และการเข้าสู่ระบบ
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  role_id   TINYINT UNSIGNED NOT NULL,
  role_name VARCHAR(20)      NOT NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_roles_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  user_id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  role_id              TINYINT UNSIGNED NOT NULL,
  email                VARCHAR(255)     NOT NULL COMMENT 'เก็บเป็นตัวพิมพ์เล็ก',
  password_hash        VARCHAR(255)         NULL COMMENT 'NULL = ยังไม่ตั้งรหัสผ่าน เข้าสู่ระบบไม่ได้',
  first_name           VARCHAR(100)     NOT NULL,
  last_name            VARCHAR(100)     NOT NULL,
  phone                VARCHAR(20)          NULL,
  is_active            BOOLEAN          NOT NULL DEFAULT TRUE COMMENT 'FALSE = ระงับบัญชี',
  must_change_password BOOLEAN          NOT NULL DEFAULT FALSE,
  failed_login_count   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until         DATETIME             NULL,
  last_login_at        DATETIME             NULL,
  created_at           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role (role_id, is_active),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (role_id),
  CONSTRAINT ck_users_name CHECK (TRIM(first_name) <> '' AND TRIM(last_name) <> ''),
  CONSTRAINT ck_users_email CHECK (TRIM(email) <> '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students_detail (
  student_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  student_code VARCHAR(20)  NOT NULL COMMENT 'รหัสนักศึกษา (API เรียกว่า studentId)',
  faculty      VARCHAR(150)     NULL,
  major        VARCHAR(150)     NULL,
  PRIMARY KEY (student_id),
  UNIQUE KEY uq_students_user (user_id),
  UNIQUE KEY uq_students_code (student_code),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users (user_id),
  CONSTRAINT ck_students_code CHECK (TRIM(student_code) <> '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED    NOT NULL,
  token_hash CHAR(64)        NOT NULL COMMENT 'SHA-256 ของค่าใน cookie ไม่เก็บค่าจริง',
  remember   BOOLEAN         NOT NULL DEFAULT FALSE,
  expires_at DATETIME        NOT NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY ix_sessions_user (user_id),
  KEY ix_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
  token_id   BIGINT UNSIGNED        NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED           NOT NULL,
  purpose    ENUM('reset', 'setup') NOT NULL DEFAULT 'reset' COMMENT 'setup = ตั้งรหัสครั้งแรกของบัญชีใหม่',
  token_hash CHAR(64)               NOT NULL,
  expires_at DATETIME               NOT NULL,
  used_at    DATETIME                   NULL,
  created_at DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_id),
  UNIQUE KEY uq_reset_token (token_hash),
  KEY ix_reset_user (user_id, created_at),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- การฝึกงานและพี่เลี้ยง
-- ---------------------------------------------------------------------------

CREATE TABLE internships (
  internship_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id        INT UNSIGNED NOT NULL,
  organization_name VARCHAR(200) NOT NULL,
  position          VARCHAR(150) NOT NULL,
  semester          VARCHAR(50)  NOT NULL,
  intern_start      DATE         NOT NULL,
  intern_end        DATE         NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (internship_id),
  UNIQUE KEY uq_internships_student (student_id),
  CONSTRAINT fk_internships_student FOREIGN KEY (student_id) REFERENCES students_detail (student_id),
  CONSTRAINT ck_internships_period CHECK (intern_end > intern_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เวลาเข้างานและเลิกงาน เก็บเป็นช่วง รายการของวันใดใช้แถวล่าสุดที่ effective_from ไม่เกินวันนั้น
CREATE TABLE internship_work_hours (
  internship_id   INT UNSIGNED NOT NULL,
  effective_from  DATE         NOT NULL,
  work_start_time TIME         NOT NULL,
  work_end_time   TIME         NOT NULL,
  set_by          INT UNSIGNED     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (internship_id, effective_from),
  CONSTRAINT fk_hours_internship FOREIGN KEY (internship_id) REFERENCES internships (internship_id),
  CONSTRAINT fk_hours_set_by FOREIGN KEY (set_by) REFERENCES users (user_id),
  CONSTRAINT ck_hours_range CHECK (work_start_time >= '00:00:00' AND work_end_time < '24:00:00' AND work_end_time > work_start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mentor_assignments (
  mentor_assignment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mentor_user_id       INT UNSIGNED NOT NULL,
  student_id           INT UNSIGNED NOT NULL,
  start_date           DATE         NOT NULL,
  end_date             DATE             NULL COMMENT 'NULL = พี่เลี้ยงคนปัจจุบัน',
  assigned_by          INT UNSIGNED     NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- นักศึกษา 1 คนมีพี่เลี้ยงปัจจุบันได้คนเดียว (NULL ซ้ำได้)
  active_student_id    INT UNSIGNED GENERATED ALWAYS AS (IF(end_date IS NULL, student_id, NULL)) VIRTUAL,
  PRIMARY KEY (mentor_assignment_id),
  UNIQUE KEY uq_assign_active (active_student_id),
  KEY ix_assign_mentor (mentor_user_id, end_date),
  KEY ix_assign_student (student_id, start_date),
  CONSTRAINT fk_assign_mentor FOREIGN KEY (mentor_user_id) REFERENCES users (user_id),
  CONSTRAINT fk_assign_student FOREIGN KEY (student_id) REFERENCES students_detail (student_id),
  CONSTRAINT fk_assign_by FOREIGN KEY (assigned_by) REFERENCES users (user_id),
  CONSTRAINT ck_assign_period CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ช่วงที่พี่เลี้ยงไม่อยู่ ไม่ลบแถว
--   absent      = ไม่อยู่ในระบบ แอดมินบันทึก อนุมัติแทนได้
--   unavailable = ไม่สะดวกตรวจงาน พี่เลี้ยงแจ้งเอง
CREATE TABLE mentor_busy (
  busy_id      INT UNSIGNED                  NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED                  NOT NULL COMMENT 'พี่เลี้ยง',
  type         ENUM('absent', 'unavailable') NOT NULL,
  start_busy   DATETIME                      NOT NULL,
  end_busy     DATETIME                      NOT NULL,
  reason       TEXT                          NOT NULL,
  created_by   INT UNSIGNED                  NOT NULL,
  created_at   DATETIME                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME                      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cancelled_at DATETIME                          NULL,
  cancelled_by INT UNSIGNED                      NULL,
  PRIMARY KEY (busy_id),
  UNIQUE KEY uq_busy_owner (busy_id, user_id),
  KEY ix_busy_user (user_id, type, start_busy),
  KEY ix_busy_period (type, end_busy),
  CONSTRAINT fk_busy_user FOREIGN KEY (user_id) REFERENCES users (user_id),
  CONSTRAINT fk_busy_created_by FOREIGN KEY (created_by) REFERENCES users (user_id),
  CONSTRAINT fk_busy_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (user_id),
  CONSTRAINT ck_busy_period CHECK (end_busy > start_busy),
  CONSTRAINT ck_busy_cancel CHECK (
    (cancelled_at IS NULL AND cancelled_by IS NULL)
    OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND type = 'absent')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- รายการงาน
-- ---------------------------------------------------------------------------

CREATE TABLE work_lists (
  work_id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  student_id        INT UNSIGNED  NOT NULL,
  title             VARCHAR(255)  NOT NULL,
  description       TEXT          NOT NULL,
  work_date         DATE          NOT NULL,
  work_start        TIME              NULL,
  work_end          TIME              NULL,
  work_status       ENUM('pending', 'in_progress', 'done')               NOT NULL DEFAULT 'pending',
  review_status     ENUM('draft', 'submitted', 'returned', 'approved')   NOT NULL DEFAULT 'draft',
  time_source       ENUM('timer', 'manual', 'timer_manual_end')              NULL,
  time_edit_allowed BOOLEAN       NOT NULL DEFAULT FALSE,
  time_edited       BOOLEAN       NOT NULL DEFAULT FALSE,
  completed_at      DATETIME          NULL COMMENT 'เวลาที่บันทึกว่างานเสร็จ',
  submitted_at      DATETIME          NULL COMMENT 'ส่งตรวจครั้งล่าสุด',
  approved_by       INT UNSIGNED      NULL,
  approved_at       DATETIME          NULL,
  version           INT UNSIGNED  NOT NULL DEFAULT 1,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME          NULL,
  deleted_by        INT UNSIGNED      NULL,
  delete_reason     TEXT              NULL,
  -- กันจับเวลาซ้อน: วันเดียวกันมีรายการที่ระบบจับเวลาและยังไม่จบได้รายการเดียว
  running_student_id INT UNSIGNED GENERATED ALWAYS AS (
    IF(deleted_at IS NULL AND work_end IS NULL AND time_source = 'timer', student_id, NULL)
  ) VIRTUAL,
  PRIMARY KEY (work_id),
  UNIQUE KEY uq_work_running (running_student_id, work_date),
  KEY ix_work_student_date (student_id, work_date),
  KEY ix_work_review (review_status, submitted_at),
  CONSTRAINT fk_work_student FOREIGN KEY (student_id) REFERENCES students_detail (student_id),
  CONSTRAINT fk_work_approved_by FOREIGN KEY (approved_by) REFERENCES users (user_id),
  CONSTRAINT fk_work_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (user_id),
  CONSTRAINT ck_work_text CHECK (TRIM(title) <> '' AND TRIM(description) <> ''),
  CONSTRAINT ck_work_time_range CHECK (
    (work_start IS NULL OR (work_start >= '00:00:00' AND work_start < '24:00:00'))
    AND (work_end IS NULL OR (work_start IS NOT NULL AND work_end > work_start AND work_end < '24:00:00'))
  ),
  CONSTRAINT ck_work_status CHECK (
    (work_status = 'pending' AND work_start IS NULL AND work_end IS NULL)
    OR (work_status = 'in_progress' AND work_start IS NOT NULL AND work_end IS NULL)
    OR (work_status = 'done' AND work_start IS NOT NULL AND work_end IS NOT NULL)
  ),
  -- ส่งตรวจและอนุมัติได้เมื่องานเสร็จแล้ว
  CONSTRAINT ck_work_submitted CHECK (
    review_status IN ('draft', 'returned')
    OR (work_status = 'done' AND submitted_at IS NOT NULL)
  ),
  CONSTRAINT ck_work_approved CHECK (
    (review_status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (review_status <> 'approved' AND approved_by IS NULL AND approved_at IS NULL)
  ),
  CONSTRAINT ck_work_time_edit CHECK (time_edit_allowed = FALSE OR review_status = 'returned'),
  -- ลบแบบเก็บข้อมูล ลบได้เฉพาะฉบับร่างหรือถูกส่งกลับ
  CONSTRAINT ck_work_deleted CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND delete_reason IS NULL)
    OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL
        AND delete_reason IS NOT NULL AND TRIM(delete_reason) <> ''
        AND review_status IN ('draft', 'returned'))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachments (
  attachment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_id       INT UNSIGNED NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_type     VARCHAR(100) NOT NULL COMMENT 'MIME ที่ตรวจจากเนื้อไฟล์',
  file_size     INT UNSIGNED NOT NULL COMMENT 'ไบต์',
  storage_path  VARCHAR(500) NOT NULL COMMENT 'ตำแหน่งภายในเซิร์ฟเวอร์ ห้ามส่งออกทาง API',
  uploaded_by   INT UNSIGNED NOT NULL,
  uploaded_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    DATETIME         NULL COMMENT 'ถูกเอาออกหรือแทนที่ ไฟล์ยังเก็บไว้ดูประวัติ',
  deleted_by    INT UNSIGNED     NULL,
  PRIMARY KEY (attachment_id),
  UNIQUE KEY uq_attach_path (storage_path),
  KEY ix_attach_work (work_id, deleted_at),
  CONSTRAINT fk_attach_work FOREIGN KEY (work_id) REFERENCES work_lists (work_id),
  CONSTRAINT fk_attach_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (user_id),
  CONSTRAINT fk_attach_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (user_id),
  CONSTRAINT ck_attach_size CHECK (file_size <= 5242880),
  CONSTRAINT ck_attach_deleted CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL) OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- การตรวจ 1 ครั้ง ไม่แก้และไม่ลบแถว
CREATE TABLE work_list_reviews (
  review_id         INT UNSIGNED                        NOT NULL AUTO_INCREMENT,
  work_id           INT UNSIGNED                        NOT NULL,
  user_id           INT UNSIGNED                        NOT NULL COMMENT 'ผู้ตรวจ',
  action            ENUM('approve', 'return', 'revoke') NOT NULL,
  comment           TEXT                                    NULL,
  work_version      INT UNSIGNED                        NOT NULL COMMENT 'ฉบับที่ผู้ตรวจเห็น',
  allow_time_edit   BOOLEAN                             NOT NULL DEFAULT FALSE,
  is_proxy          BOOLEAN                             NOT NULL DEFAULT FALSE,
  on_behalf_of_user_id INT UNSIGNED                         NULL COMMENT 'พี่เลี้ยงที่แอดมินอนุมัติแทน',
  mentor_busy_id    INT UNSIGNED                            NULL COMMENT 'ช่วงไม่อยู่ที่ใช้อ้างอิง',
  created_at        DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  UNIQUE KEY uq_review_work (review_id, work_id),
  KEY ix_review_work (work_id, review_id),
  KEY ix_review_busy (mentor_busy_id, on_behalf_of_user_id),
  CONSTRAINT fk_review_work FOREIGN KEY (work_id) REFERENCES work_lists (work_id),
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users (user_id),
  CONSTRAINT fk_review_on_behalf FOREIGN KEY (on_behalf_of_user_id) REFERENCES users (user_id),
  -- ช่วงที่อ้างต้องเป็นของพี่เลี้ยงคนที่อนุมัติแทน
  CONSTRAINT fk_review_busy FOREIGN KEY (mentor_busy_id, on_behalf_of_user_id) REFERENCES mentor_busy (busy_id, user_id),
  -- ส่งกลับและย้อนการอนุมัติต้องมีความคิดเห็น
  CONSTRAINT ck_review_comment CHECK (action = 'approve' OR (comment IS NOT NULL AND TRIM(comment) <> '')),
  CONSTRAINT ck_review_time_edit CHECK (allow_time_edit = FALSE OR action = 'return'),
  -- อนุมัติแทนทำได้เฉพาะการอนุมัติ และต้องระบุทั้งพี่เลี้ยงและช่วงเวลา
  CONSTRAINT ck_review_proxy CHECK (
    (is_proxy = FALSE AND on_behalf_of_user_id IS NULL AND mentor_busy_id IS NULL)
    OR (is_proxy = TRUE AND action = 'approve' AND on_behalf_of_user_id IS NOT NULL AND mentor_busy_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เส้นเวลาของรายการ (หน้าประวัติ) 1 แถวต่อ 1 เหตุการณ์ ไม่แก้และไม่ลบแถว
CREATE TABLE work_list_history (
  history_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_id     INT UNSIGNED    NOT NULL,
  change_type ENUM('status', 'edit', 'return', 'approval', 'revoke', 'delete') NOT NULL,
  changed_by  INT UNSIGNED    NOT NULL,
  changed_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  review_id   INT UNSIGNED        NULL,
  before_data JSON                NULL COMMENT 'เฉพาะค่าที่เปลี่ยน ก่อนแก้',
  after_data  JSON                NULL COMMENT 'เฉพาะค่าที่เปลี่ยน หลังแก้',
  reason      TEXT                NULL,
  PRIMARY KEY (history_id),
  UNIQUE KEY uq_history_review (review_id),
  KEY ix_history_work (work_id, history_id),
  CONSTRAINT fk_history_work FOREIGN KEY (work_id) REFERENCES work_lists (work_id),
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users (user_id),
  CONSTRAINT fk_history_review FOREIGN KEY (review_id, work_id) REFERENCES work_list_reviews (review_id, work_id),
  CONSTRAINT ck_history_review CHECK (
    (change_type IN ('return', 'approval', 'revoke') AND review_id IS NOT NULL)
    OR (change_type IN ('status', 'edit', 'delete') AND review_id IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- การแจ้งเตือน
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED    NOT NULL COMMENT 'ผู้รับ',
  type            ENUM('new_submission', 'overdue_review', 'returned', 'approved', 'proxy_approved',
                       'absent_mentor_pending', 'student_without_mentor') NOT NULL,
  work_id         INT UNSIGNED        NULL,
  mentor_busy_id  INT UNSIGNED        NULL COMMENT 'ใช้กับ absent_mentor_pending',
  message         TEXT            NOT NULL,
  dedupe_key      VARCHAR(100)        NULL COMMENT 'เรื่องที่แจ้งครั้งเดียวต่อผู้รับ เช่น overdue:15',
  read_at         DATETIME            NULL COMMENT 'NULL = ยังไม่อ่าน',
  email_sent_at   DATETIME            NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  UNIQUE KEY uq_notify_dedupe (user_id, dedupe_key),
  KEY ix_notify_user (user_id, created_at),
  KEY ix_notify_work (work_id),
  CONSTRAINT fk_notify_user FOREIGN KEY (user_id) REFERENCES users (user_id),
  CONSTRAINT fk_notify_work FOREIGN KEY (work_id) REFERENCES work_lists (work_id),
  CONSTRAINT fk_notify_busy FOREIGN KEY (mentor_busy_id) REFERENCES mentor_busy (busy_id),
  CONSTRAINT ck_notify_target CHECK (
    (type IN ('new_submission', 'overdue_review', 'returned', 'approved', 'proxy_approved')
      AND work_id IS NOT NULL AND mentor_busy_id IS NULL)
    OR (type = 'absent_mentor_pending' AND work_id IS NULL AND mentor_busy_id IS NOT NULL AND dedupe_key IS NOT NULL)
    OR (type = 'student_without_mentor' AND work_id IS NULL AND mentor_busy_id IS NULL AND dedupe_key IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- นักศึกษาที่การแจ้งเตือนแบบรวมครอบคลุม ใช้ดูว่ามีคนใหม่เข้ามาหรือไม่
CREATE TABLE notification_members (
  notification_id BIGINT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED    NOT NULL,
  PRIMARY KEY (notification_id, student_id),
  CONSTRAINT fk_member_notify FOREIGN KEY (notification_id) REFERENCES notifications (notification_id) ON DELETE CASCADE,
  CONSTRAINT fk_member_student FOREIGN KEY (student_id) REFERENCES students_detail (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- การตั้งค่าและการนำเข้าผู้ใช้
-- ---------------------------------------------------------------------------

-- มีแถวเดียว (setting_id = 1)
CREATE TABLE system_settings (
  setting_id          TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  backdate_limit_days TINYINT UNSIGNED  NOT NULL DEFAULT 3,
  review_overdue_days TINYINT UNSIGNED  NOT NULL DEFAULT 3,
  max_failed_logins   TINYINT UNSIGNED  NOT NULL DEFAULT 5,
  lock_minutes        SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  current_semester    VARCHAR(50)       NOT NULL COMMENT 'ค่าตั้งต้นของข้อมูลฝึกงานใหม่',
  updated_by          INT UNSIGNED          NULL,
  updated_at          DATETIME              NULL COMMENT 'NULL = ยังไม่เคยแก้',
  PRIMARY KEY (setting_id),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users (user_id),
  CONSTRAINT ck_settings_single CHECK (setting_id = 1),
  CONSTRAINT ck_settings_days CHECK (backdate_limit_days BETWEEN 1 AND 30 AND review_overdue_days BETWEEN 1 AND 30),
  CONSTRAINT ck_settings_lock CHECK (max_failed_logins >= 1 AND lock_minutes >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ผลตรวจไฟล์ที่รอยืนยัน และประวัติการนำเข้า ผลตรวจที่หมดอายุและยังไม่ยืนยันลบทิ้งได้
CREATE TABLE user_imports (
  import_id   CHAR(36)     NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_size   INT UNSIGNED NOT NULL,
  created_by  INT UNSIGNED NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME     NOT NULL,
  imported_at DATETIME         NULL COMMENT 'NULL = ยังไม่ยืนยัน',
  imported_by INT UNSIGNED     NULL,
  PRIMARY KEY (import_id),
  KEY ix_import_done (imported_at),
  CONSTRAINT fk_import_created_by FOREIGN KEY (created_by) REFERENCES users (user_id),
  CONSTRAINT fk_import_imported_by FOREIGN KEY (imported_by) REFERENCES users (user_id),
  CONSTRAINT ck_import_done CHECK (
    (imported_at IS NULL AND imported_by IS NULL) OR (imported_at IS NOT NULL AND imported_by IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ข้อความตามที่กรอกในไฟล์ จึงไม่บังคับรูปแบบ
CREATE TABLE user_import_rows (
  import_id       CHAR(36)          NOT NULL,
  sheet_row       SMALLINT UNSIGNED NOT NULL COMMENT 'เลขแถวในไฟล์ แถวหัวตารางคือ 1',
  first_name      TEXT              NOT NULL,
  last_name       TEXT              NOT NULL,
  email           TEXT              NOT NULL,
  role_text       TEXT              NOT NULL,
  student_code    TEXT              NOT NULL,
  errors          JSON              NOT NULL COMMENT 'รายการข้อความ ว่าง = ผ่าน',
  created_user_id INT UNSIGNED          NULL COMMENT 'บัญชีที่สร้างจากแถวนี้',
  PRIMARY KEY (import_id, sheet_row),
  UNIQUE KEY uq_import_user (created_user_id),
  CONSTRAINT fk_import_row FOREIGN KEY (import_id) REFERENCES user_imports (import_id) ON DELETE CASCADE,
  CONSTRAINT fk_import_row_user FOREIGN KEY (created_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- ข้อมูลตั้งต้นที่ระบบต้องมี (ไม่มีบัญชีตัวอย่าง)
-- ---------------------------------------------------------------------------

INSERT INTO roles (role_id, role_name) VALUES (1, 'student'), (2, 'supervisor'), (3, 'admin');

INSERT INTO system_settings (setting_id, current_semester) VALUES (1, 'ภาคการศึกษาที่ 1/2569');
