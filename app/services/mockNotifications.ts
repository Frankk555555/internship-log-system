// การแจ้งเตือนของข้อมูลจำลอง อยู่ในหน่วยความจำเหมือนข้อมูลอื่น
import type { ReviewItem } from '~/types/review'
import type { AppNotification, NotificationType } from '~/types/notification'
import type { UserRole, WorkLog } from '~/types/worklog'
import { addDays, toThaiTimeParts } from '~/utils/date'
import * as db from './mockData'

type Stored = Omit<AppNotification, 'canEdit'> & { recipient: UserRole }

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
}

function message(type: NotificationType, owner: Owner, worklog: WorkLog) {
  if (type === 'new_submission') return `${owner.name} ส่ง “${worklog.title}”`
  if (type === 'overdue_review') return `“${worklog.title}” ของ${owner.name} รอตรวจเกิน ${db.settings.reviewOverdueDays} วัน`
  const comment = worklog.reviewComment ? `\nความเห็น: ${worklog.reviewComment}` : ''
  return `“${worklog.title}”${comment}`
}

export function addNotification(type: NotificationType, owner: Owner, worklog: WorkLog, createdAt: string, isRead = false) {
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

/** ใหม่สุดก่อน */
export function notificationsFor(role: UserRole) {
  return stored
    .filter(entry => entry.recipient === role)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

/** ไม่ระบุ ids = ทุกรายการของบทบาทนั้น */
export function markRead(role: UserRole, ids?: number[]) {
  for (const entry of stored) {
    if (entry.recipient === role && (!ids || ids.includes(entry.id))) entry.isRead = true
  }
}

// ข้อมูลตั้งต้น อ้างอิงรายการตัวอย่าง
function seed(type: NotificationType, worklogId: number, isRead = false) {
  const owners = [{ studentId: db.student.studentId!, name: db.student.name, worklogs: db.studentWorklogs }, ...db.otherStudents]
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
