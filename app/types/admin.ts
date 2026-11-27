// ข้อมูลของพื้นที่แอดมิน รูปแบบเดียวกับ worklog.ts (วันเวลา = ISO 8601)
import type { UserRole } from './worklog'

export type AccountStatus = 'active' | 'locked' | 'suspended'

export interface AdminUser {
  id: number
  name: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  /** มีเฉพาะนักศึกษา */
  studentId?: string
  status: AccountStatus
  /** มีเมื่อ status = locked */
  lockedUntil?: string
  /** ไม่มีค่า = ยังไม่เคยเข้าใช้ */
  lastLoginAt?: string
}

export interface UserFilter {
  role: UserRole | 'all'
  status: AccountStatus | 'all'
  /** ค้นชื่อ อีเมล หรือรหัสนักศึกษา */
  q: string
  /** เริ่มที่ 1 */
  page: number
}

export interface UserList {
  items: AdminUser[]
  /** จำนวนทั้งหมดที่ตรงกับตัวกรอง */
  total: number
  pageSize: number
  /** จำนวนตามบทบาท นับตามสถานะและคำค้น ไม่นับตัวกรองบทบาท */
  counts: Record<UserRole | 'all', number>
}

export interface UserInput {
  firstName: string
  lastName: string
  email: string
  /** กำหนดตอนเพิ่มผู้ใช้ เปลี่ยนภายหลังไม่ได้ */
  role: UserRole
  studentId?: string
}

export type InternshipFilter = 'all' | 'no_mentor' | 'no_hours'

/** ข้อมูลฝึกงานของนักศึกษาหนึ่งคน ช่องที่ไม่มีค่า = ยังไม่ได้กรอก */
export interface InternshipRow {
  studentId: string
  name: string
  company?: string
  position?: string
  startDate?: string
  endDate?: string
  /** เวลางานที่ใช้กับวันนี้ */
  workStartTime?: string
  workEndTime?: string
  mentorName?: string
}

export interface InternshipQuery {
  filter: InternshipFilter
  /** ค้นชื่อ รหัสนักศึกษา หรือหน่วยงาน */
  q: string
  /** เริ่มที่ 1 */
  page: number
}

export interface InternshipList {
  items: InternshipRow[]
  total: number
  pageSize: number
  /** นับตามคำค้น ไม่นับตัวกรอง */
  counts: Record<InternshipFilter, number>
}

export interface MentorPeriod {
  mentorName: string
  from: string
  /** ไม่มีค่า = ดูแลอยู่ */
  to?: string
}

export interface InternshipDetail extends InternshipRow {
  mentorId?: number
  /** พี่เลี้ยงที่เลือกได้ */
  mentors: { id: number, name: string }[]
  /** ใหม่สุดก่อน */
  mentorHistory: MentorPeriod[]
  /** งานรอตรวจ ย้ายไปพี่เลี้ยงคนใหม่เมื่อเปลี่ยน */
  pendingCount: number
}

export interface InternshipInput {
  company: string
  position: string
  startDate: string
  endDate: string
  workStartTime: string
  workEndTime: string
  mentorId: number
}

export interface SystemSettings {
  /** บันทึกและแก้ไขย้อนหลังได้กี่วัน (5.6) */
  backdateLimitDays: number
  /** รอตรวจเกินกี่วันถือว่าค้างตรวจ (9.3) */
  reviewOverdueDays: number
  /** กรอกรหัสผ่านผิดกี่ครั้งจึงล็อกบัญชี แก้ที่หน้าจอไม่ได้ (1.2) */
  maxFailedLogins: number
  /** ล็อกกี่นาที แก้ที่หน้าจอไม่ได้ (1.2) */
  lockMinutes: number
  /** ไม่มีค่า = ยังไม่เคยแก้ */
  updatedAt?: string
  updatedBy?: string
}

export type SystemSettingsInput = Pick<SystemSettings, 'backdateLimitDays' | 'reviewOverdueDays'>

export interface AdminApi {
  getSystemSettings(): Promise<SystemSettings>
  /** คืนค่าล่าสุดหลังบันทึก */
  saveSystemSettings(input: SystemSettingsInput): Promise<SystemSettings>
  getUsers(filter: UserFilter): Promise<UserList>
  /** อีเมลหรือรหัสนักศึกษาซ้ำ: ApiError 409 code email_taken, student_id_taken */
  createUser(input: UserInput): Promise<AdminUser>
  updateUser(id: number, input: UserInput): Promise<AdminUser>
  /** ระงับแล้ว session ของผู้นั้นใช้ไม่ได้ทันที แอดมินระงับตัวเองไม่ได้ */
  setUserSuspended(id: number, suspended: boolean): Promise<AdminUser>
  unlockUser(id: number): Promise<AdminUser>
  getInternships(query: InternshipQuery): Promise<InternshipList>
  getInternshipDetail(studentId: string): Promise<InternshipDetail>
  /** เวลางานใหม่มีผลกับรายการตั้งแต่วันที่บันทึก */
  saveInternship(studentId: string, input: InternshipInput): Promise<InternshipDetail>
}
