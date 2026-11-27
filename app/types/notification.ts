/** ประเภทตามขอบเขตงานข้อ 9.3 ผลตรวจที่แจ้งนักศึกษา และการอนุมัติแทนที่แจ้งพี่เลี้ยง */
export type NotificationType = 'new_submission' | 'overdue_review' | 'returned' | 'approved' | 'proxy_approved'

export interface AppNotification {
  id: number
  type: NotificationType
  title: string
  message: string
  /** วันเวลา ISO 8601 */
  createdAt: string
  isRead: boolean
  worklogId: number
  /** นักศึกษาเจ้าของรายการ ใช้กับการแจ้งเตือนของพี่เลี้ยง */
  studentId?: string
  /** รายการที่ถูกส่งกลับยังแก้ไขได้ ใช้เลือกว่าจะเปิดหน้าแก้ไขหรือหน้าประวัติ */
  canEdit?: boolean
}
