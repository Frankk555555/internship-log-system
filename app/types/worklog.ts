// รูปแบบข้อมูลที่รับ/ส่งกับ backend
// วันที่ = "YYYY-MM-DD" (ค.ศ.), เวลา = "HH:MM" (24 ชม.), วันเวลา = ISO 8601
// การแปลงเป็น พ.ศ. และข้อความภาษาไทยทำที่หน้าจอเท่านั้น

export type UserRole = 'student' | 'supervisor' | 'admin'

export type WorkStatus = 'pending' | 'in_progress' | 'done'

export type ReviewStatus = 'draft' | 'submitted' | 'returned' | 'approved'

export type BadgeTone = 'slate' | 'draft' | 'blue' | 'green' | 'amber' | 'rose'

export interface UserProfile {
  /** ชื่อและนามสกุลต่อกัน สำหรับแสดงผล */
  name: string
  firstName: string
  lastName: string
  email: string
  initials: string
  studentId?: string
  role: UserRole
  /** ยังใช้รหัสผ่านเริ่มต้น ต้องตั้งรหัสใหม่ก่อนใช้งานส่วนอื่น */
  mustChangePassword?: boolean
  /** วันที่ตั้งต้นของหน้ารายงานรายสัปดาห์ (ปกติคือวันนี้ของเซิร์ฟเวอร์) */
  defaultReportDate: string
}

/** เวลางานของสถานประกอบการ แอดมินเป็นผู้กำหนด */
export interface WorkHours {
  /** เวลาเข้างาน */
  workStartTime: string
  /** เวลาเลิกงาน */
  workEndTime: string
}

/** เวลางานช่วงหนึ่ง ใช้กับรายการของวันที่ตั้งแต่ effectiveFrom */
export interface WorkHoursPeriod extends WorkHours {
  effectiveFrom: string
}

export interface InternshipInfo extends WorkHours {
  company: string
  position: string
  mentorName: string
  /** ยังไม่มีพี่เลี้ยง = บันทึกเวลาและส่งตรวจไม่ได้ */
  hasMentor: boolean
  semester: string
  /** ร้อยละของระยะเวลาฝึกที่ผ่านไปแล้ว */
  progress: number
  startDate: string
  endDate: string
}

export interface Attachment {
  /** ค่าติดลบ = ไฟล์ที่เพิ่งเลือก ยังไม่ได้อัปโหลด */
  id: number
  name: string
  size: number
  uploadedAt: string
  url?: string
  /** มีค่าเฉพาะไฟล์ที่ยังไม่ได้อัปโหลด */
  file?: File
  /** ข้อความเมื่อไฟล์ไม่ผ่านเงื่อนไข */
  error?: string
}

export interface WorkLog {
  id: number
  date: string
  title: string
  description?: string
  startTime?: string
  endTime?: string
  workStatus: WorkStatus
  reviewStatus: ReviewStatus
  attachments?: Attachment[]
  submittedAt?: string
  /** เพิ่มทุกครั้งที่รายการถูกบันทึกหรือเปลี่ยนสถานะตรวจ */
  version?: number
  /** ความเห็นล่าสุดของผู้ตรวจ */
  reviewComment?: string
  /**
   * timer = ระบบจับเวลาจากฟอร์มรายการใหม่, manual = นักศึกษากรอกเวลาเอง,
   * timer_manual_end = ระบบจับเวลาเริ่ม แต่ลืมกดเสร็จสิ้นจึงกรอกเวลาสิ้นสุดเอง (ยังล็อกเหมือน timer)
   */
  timeSource?: 'timer' | 'manual' | 'timer_manual_end'
  /** พี่เลี้ยงเปิดให้แก้วันที่และเวลาตอนส่งกลับ */
  timeEditAllowed?: boolean
  /** มีการแก้วันที่หรือเวลาหลังถูกส่งกลับ */
  timeEdited?: boolean
  /** ชื่อผู้ตรวจและเวลาที่ตรวจครั้งล่าสุด */
  reviewedBy?: string
  reviewedAt?: string
  /** false = แก้ไขไม่ได้แล้ว เช่น เลยกำหนดแก้ไขหลังถูกส่งกลับ */
  canEdit?: boolean
  /** มีค่า = ถูกลบแล้ว ไม่อยู่ในรายการใด ดูได้จากประวัติ */
  deletion?: { deletedAt: string, deletedBy: string, reason: string }
}

/** ประวัติการเปลี่ยนแปลง 1 ครั้ง (ขอบเขตงานข้อ 7.2 และ 8.2) */
export interface HistoryEvent {
  id: number
  type: 'status' | 'edit' | 'return' | 'approval' | 'delete'
  changedAt: string
  title: string
  actorName: string
  before: string
  after: string
}

export interface StudentDashboard {
  /** วันที่ปัจจุบันของเซิร์ฟเวอร์ */
  today: string
  internship: InternshipInfo
  summary: {
    approvedCount: number
    waitingReviewCount: number
    returnedCount: number
  }
  recentWorklogs: WorkLog[]
}

export interface DailyWorklogs {
  hasMentor: boolean
  date: string
  semester: string
  worklogs: WorkLog[]
  /** ช่วงเวลาที่พี่เลี้ยงไม่สะดวกตรวจงานในวันนั้น */
  mentorUnavailable?: { startTime: string, endTime: string }
}

export type WorklogFormMode = 'new' | 'backdate'

/** ค่าตั้งต้นและเงื่อนไขของฟอร์มบันทึกงาน */
export interface WorklogFormContext extends WorkHours {
  /** เวลางานตามวันเริ่มมีผล เรียงจากเก่าไปใหม่ ไม่ส่ง = ใช้เวลางานปัจจุบันกับทุกวัน */
  hoursHistory?: WorkHoursPeriod[]
  hasMentor: boolean
  today: string
  backdateLimitDays: number
  internshipStart: string
  internshipEnd: string
  /** งานของวันนี้ที่ยังจับเวลาอยู่ ถ้ามีจะเริ่มงานใหม่ไม่ได้ */
  runningWorklog?: { id: number, title: string, startTime: string }
  defaults: {
    /** ค่าว่าง = ผู้ใช้เลือกวันเอง (บันทึกย้อนหลัง) */
    date: string
    startTime?: string
    endTime?: string
    title: string
    description: string
    attachments: Attachment[]
  }
}

export interface SaveWorklogInput {
  /** ไม่มีค่า = สร้างรายการใหม่ */
  id?: number
  mode: WorklogFormMode
  date: string
  /** ไม่มีค่าได้เฉพาะฉบับร่างที่ยังไม่เริ่มงาน */
  startTime?: string
  endTime?: string
  title: string
  description: string
  /** ไฟล์เดิมบนเซิร์ฟเวอร์ที่ยังเก็บไว้ */
  keepAttachmentIds: number[]
  newFiles: File[]
  /** true = ส่งตรวจ, false = บันทึกฉบับร่าง */
  submit: boolean
}

export interface WorklogHistory {
  worklog: WorkLog
  /** เรียงจากใหม่ไปเก่า */
  events: HistoryEvent[]
}

export interface MentorStudent {
  studentId: string
  name: string
}

/** ข้อมูลดิบของรายงานรายสัปดาห์ของนักศึกษา 1 คน */
export interface WeeklyReportData extends MentorStudent {
  mentorName: string
  worklogs: WorkLog[]
}
