import type { WorkLog } from './worklog'

/** pending = เฉพาะรอตรวจ, all = ทุกรายการที่ส่งเข้ามา (ขอบเขตงานข้อ 9.1) */
export type ReviewFilter = 'pending' | 'all'

export interface ReviewItem {
  worklog: WorkLog
  studentId: string
  studentName: string
  submittedAt: string
  /** จำนวนวันที่รอตรวจ มีค่าเฉพาะรายการที่ยังรอตรวจ */
  pendingDays?: number
  /** ค้างตรวจเกินระยะเวลาที่กำหนด (9.3) */
  isOverdue: boolean
}

/** รายการที่ถูกลบ worklog.deletion บอกผู้ลบ เวลา และเหตุผล */
export interface DeletedWorklog {
  worklog: WorkLog
  studentId: string
  studentName: string
}

export interface ReviewQueue {
  /** รายการที่ส่งกลับแล้วนักศึกษาลบ ใหม่สุดก่อน แสดงทุกแท็บ */
  deletedReturns: DeletedWorklog[]
  /** รอตรวจ: เก่าสุดก่อน, ทั้งหมด: ใหม่สุดก่อน */
  items: ReviewItem[]
  total: number
  pendingCount: number
  /** เกินกี่วันถือว่าค้างตรวจ (แอดมินปรับได้) */
  overdueDays: number
}

/** version ที่ผู้ตรวจเห็น ใช้กันการอนุมัติรายการที่ถูกแก้หลังเปิดดู (10.3) */
export interface ReviewTarget {
  id: number
  version: number
}

export interface ReviewResult {
  succeededIds: number[]
  failures: { id: number, message: string }[]
}

export interface UnavailabilityInput {
  date: string
  startTime: string
  endTime: string
  reason: string
}
