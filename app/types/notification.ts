/** ประเภทตามขอบเขตงานข้อ 9.3 ผลตรวจที่แจ้งนักศึกษา การอนุมัติแทนที่แจ้งพี่เลี้ยง และเรื่องที่แจ้งแอดมิน */
export type NotificationType = 'new_submission' | 'overdue_review' | 'returned' | 'approved' | 'proxy_approved'
  | 'absent_mentor_pending' | 'student_without_mentor'

export interface AppNotification {
  id: number
  type: NotificationType
  title: string
  message: string
  /** วันเวลา ISO 8601 */
  createdAt: string
  isRead: boolean
  /** ไม่มีในการแจ้งเตือนของแอดมิน */
  worklogId?: number
  /** นักศึกษาเจ้าของรายการ ใช้กับการแจ้งเตือนของพี่เลี้ยง */
  studentId?: string
  /** พี่เลี้ยงที่ไม่อยู่ ใช้กับ absent_mentor_pending */
  mentorId?: number
  /** รายการที่ถูกส่งกลับยังแก้ไขได้ ใช้เลือกว่าจะเปิดหน้าแก้ไขหรือหน้าประวัติ */
  canEdit?: boolean
}
