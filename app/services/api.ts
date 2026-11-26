import type { AuthApi } from '~/types/auth'
import type { ReviewFilter, ReviewQueue, ReviewResult, ReviewTarget, UnavailabilityInput } from '~/types/review'
import type {
  DailyWorklogs,
  InternshipInfo,
  MentorStudent,
  SaveWorklogInput,
  StudentDashboard,
  WeeklyReportData,
  WorkLog,
  WorklogFormContext,
  WorklogFormMode,
  WorklogHistory,
} from '~/types/worklog'

/**
 * สัญญาระหว่างหน้าจอกับ backend ทุกหน้าเรียกข้อมูลผ่าน interface นี้เท่านั้น
 * ปัจจุบันมี 2 ตัว: mockApi (ข้อมูลจำลอง) และ createHttpApi (เรียก REST จริง)
 */
export interface Api extends AuthApi {
  // นักศึกษา
  getDashboard(): Promise<StudentDashboard>
  getInternship(): Promise<InternshipInfo>
  getDailyWorklogs(date?: string): Promise<DailyWorklogs>
  listWorklogs(from: string, to: string): Promise<WorkLog[]>
  getWorklog(id: number): Promise<WorkLog>
  getWorklogFormContext(mode: WorklogFormMode): Promise<WorklogFormContext>
  /** เวลาปัจจุบันของเซิร์ฟเวอร์ (ISO 8601) */
  getServerTime(): Promise<string>
  saveWorklog(input: SaveWorklogInput): Promise<WorkLog>
  /** เริ่มงานของรายการที่รอดำเนินการ เซิร์ฟเวอร์บันทึกวันที่และเวลาปัจจุบัน */
  startWorklog(id: number): Promise<WorkLog>
  /** จบงานที่กำลังดำเนินการของวันนี้ เซิร์ฟเวอร์บันทึกเวลาสิ้นสุด (7.3) */
  finishWorklog(id: number): Promise<WorkLog>
  deleteWorklog(id: number, reason: string): Promise<void>
  getWorklogHistory(id: number): Promise<WorklogHistory>
  getMyWeeklyReport(weekStart: string): Promise<WeeklyReportData>

  // พี่เลี้ยง
  getMentorStudents(): Promise<MentorStudent[]>
  /** ไม่ระบุ studentId = นักศึกษาในความดูแลทั้งหมด */
  getMentorWeeklyReports(weekStart: string, studentId?: string): Promise<WeeklyReportData[]>
  getReviewQueue(filter: ReviewFilter, limit: number): Promise<ReviewQueue>
  approveWorklogs(targets: ReviewTarget[], comment?: string): Promise<ReviewResult>
  /** ต้องมีความเห็นทุกครั้ง (10.5) allowTimeEdit = เปิดให้นักศึกษาแก้วันที่และเวลา */
  returnWorklogs(targets: ReviewTarget[], comment: string, allowTimeEdit?: boolean): Promise<ReviewResult>
  /** พี่เลี้ยงแจ้งช่วงไม่สะดวกตรวจงาน (ประเภท unavailable) */
  createUnavailability(input: UnavailabilityInput): Promise<void>
}

/** ข้อผิดพลาดจาก API ที่แสดงให้ผู้ใช้อ่านได้ */
export class ApiError extends Error {
  /** รหัสให้หน้าจอแยกกรณี เช่น account_locked */
  readonly code?: string
  /** เวลาที่ปลดล็อกบัญชี (ISO 8601) */
  readonly lockedUntil?: string

  constructor(message: string, readonly statusCode = 500, details: { code?: string, lockedUntil?: string } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = details.code
    this.lockedUntil = details.lockedUntil
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}
