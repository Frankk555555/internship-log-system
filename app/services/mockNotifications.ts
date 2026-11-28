// การแจ้งเตือนของข้อมูลจำลอง อยู่ในหน่วยความจำเหมือนข้อมูลอื่น
import type { ReviewItem } from '~/types/review'
import type { AppNotification, NotificationType } from '~/types/notification'
import type { UserRole, WorkLog } from '~/types/worklog'
import { addDays, toThaiTimeParts } from '~/utils/date'
import * as db from './mockData'

type Stored = Omit<AppNotification, 'canEdit'> & { recipient: UserRole, key?: string }
type AdminNotificationType = Extract<NotificationType, 'absent_mentor_pending' | 'student_without_mentor'>

interface Owner {
  studentId: string
  name: string
}

let nextId = 9000
const stored: Stored[] = []

const titles: Record<NotificationType, string> = {
  new_submission: 'มีรายการรอตรวจ',
  overdue_review: 'ค้างตรวจ',
  returned: 'ส่งกลับแก้ไข',
  approved: 'อนุมัติแล้ว',
  proxy_approved: 'แอดมินอนุมัติแทน',
  absent_mentor_pending: 'พี่เลี้ยงไม่อยู่ มีงานรอตรวจ',
  student_without_mentor: 'นักศึกษายังไม่มีพี่เลี้ยง',
}

function message(type: Exclude<NotificationType, AdminNotificationType>, owner: Owner, worklog: WorkLog) {
  if (type === 'new_submission') return `${owner.name} ส่ง “${worklog.title}”`
  if (type === 'overdue_review') return `“${worklog.title}” ของ${owner.name} รอตรวจเกิน ${db.settings.reviewOverdueDays} วัน`
  if (type === 'proxy_approved') return `${worklog.reviewedBy} อนุมัติ “${worklog.title}” ของ${owner.name} แทน${worklog.proxyFor}`
  const proxy = worklog.proxyFor ? `\n${worklog.reviewedBy} อนุมัติแทน${worklog.proxyFor}` : ''
  const comment = worklog.reviewComment ? `\nความเห็น: ${worklog.reviewComment}` : ''
  return `“${worklog.title}”${proxy}${comment}`
}

export function addNotification(type: Exclude<NotificationType, AdminNotificationType>, owner: Owner, worklog: WorkLog, createdAt: string, isRead = false) {
  stored.push({
    id: nextId++,
    recipient: type === 'returned' || type === 'approved' ? 'student' : 'supervisor',
    type,
    title: titles[type],
    message: message(type, owner, worklog),
    createdAt,
    isRead,
    worklogId: worklog.id,
    studentId: owner.studentId,
  })
}

/** สร้างแจ้งเตือนค้างตรวจครั้งเดียวต่อรายการ เมื่อรอตรวจเกินกำหนด (9.3) */
export function addOverdueNotifications(waiting: ReviewItem[]) {
  for (const item of waiting) {
    if (!item.isOverdue || stored.some(entry => entry.type === 'overdue_review' && entry.worklogId === item.worklog.id)) continue
    const day = addDays(toThaiTimeParts(item.submittedAt).date, db.settings.reviewOverdueDays + 1)
    addNotification('overdue_review', { studentId: item.studentId, name: item.studentName }, item.worklog, `${day}T08:00:00+07:00`)
  }
}

export interface AdminAlert {
  /** หนึ่งเรื่องต่อหนึ่ง key */
  key: string
  type: AdminNotificationType
  message: string
  mentorId?: number
  /** ผู้ที่เรื่องนี้ครอบคลุม มีคนใหม่เพิ่มเข้ามาจึงแจ้งเป็นยังไม่อ่านอีกครั้ง */
  members?: number[]
}

const alertMembers = new Map<string, number[]>()

/**
 * การแจ้งเตือนของแอดมินตามเรื่องที่ยังค้างอยู่: เรื่องใหม่เพิ่มครั้งเดียว เรื่องเดิมปรับข้อความโดยคงสถานะอ่าน
 * เว้นแต่มีคนใหม่เข้ามาในเรื่องนั้น เรื่องที่จัดการแล้วเอาออก ถ้าเกิดขึ้นอีกจึงแจ้งใหม่
 */
export function syncAdminAlerts(alerts: AdminAlert[], now: string) {
  for (let index = stored.length - 1; index >= 0; index--) {
    const { recipient, key } = stored[index]!
    if (recipient !== 'admin' || alerts.some(alert => alert.key === key)) continue
    stored.splice(index, 1)
    alertMembers.delete(key!)
  }
  for (const { members = [], ...alert } of alerts) {
    const existing = stored.find(entry => entry.key === alert.key)
    const hasNewMember = members.some(member => !alertMembers.get(alert.key)?.includes(member))
    if (existing) Object.assign(existing, alert, hasNewMember ? { isRead: false, createdAt: now } : {})
    else stored.push({ ...alert, id: nextId++, recipient: 'admin', title: titles[alert.type], createdAt: now, isRead: false })
    alertMembers.set(alert.key, members)
  }
}

/** studentIds: นักศึกษาที่ผู้ใช้เกี่ยวข้อง (ตนเอง หรือผู้ที่ตนดูแล) แอดมินเห็นทุกเรื่องของแอดมิน ใหม่สุดก่อน */
export function notificationsFor(role: UserRole, studentIds: string[]) {
  return stored
    .filter(entry => entry.recipient === role && (role === 'admin' || studentIds.includes(entry.studentId!)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

/** รหัสนักศึกษาถูกแก้ ลิงก์ในแจ้งเตือนต้องชี้รหัสใหม่ */
export function reassignStudent(from: string, to: string) {
  for (const entry of stored) {
    if (entry.studentId === from) entry.studentId = to
  }
}

/** ไม่ระบุ ids = ทุกรายการที่ผู้ใช้เห็น */
export function markRead(role: UserRole, studentIds: string[], ids?: number[]) {
  for (const entry of notificationsFor(role, studentIds)) {
    if (!ids || ids.includes(entry.id)) entry.isRead = true
  }
}

// ข้อมูลตั้งต้น อ้างอิงรายการตัวอย่าง
function seed(type: Exclude<NotificationType, AdminNotificationType>, worklogId: number, isRead = false) {
  const owners = db.students.map(({ profile, worklogs }) => ({ studentId: profile.studentId!, name: profile.name, worklogs }))
  for (const owner of owners) {
    const worklog = owner.worklogs.find(log => log.id === worklogId)
    if (!worklog) continue
    const createdAt = type === 'new_submission' ? worklog.submittedAt! : worklog.reviewedAt ?? worklog.submittedAt!
    addNotification(type, owner, worklog, createdAt, isRead)
  }
}

seed('returned', 3)
seed('approved', 101)
seed('approved', 105)
seed('returned', 204, true)
seed('new_submission', 102)
seed('new_submission', 104)
seed('new_submission', 312, true)
