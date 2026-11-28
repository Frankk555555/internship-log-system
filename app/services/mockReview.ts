// ส่วนตรวจงานของข้อมูลจำลอง พี่เลี้ยงตรวจเองและแอดมินอนุมัติแทนใช้ร่วมกัน
import type { ReviewItem, ReviewResult, ReviewTarget } from '~/types/review'
import type { HistoryEvent, UserProfile, WorkLog } from '~/types/worklog'
import { toThaiTimeParts } from '~/utils/date'
import * as db from './mockData'
import { addNotification } from './mockNotifications'

let nextEventId = 20000

export function appendHistory(worklogId: number, event: Omit<HistoryEvent, 'id' | 'changedAt'>, changedAt: string) {
  db.histories[worklogId] = [{ ...event, id: nextEventId++, changedAt }, ...db.histories[worklogId] ?? []]
}

export function toReviewItem(studentId: string, studentName: string, worklog: WorkLog): ReviewItem {
  const submittedAt = worklog.submittedAt!
  const pendingDays = worklog.reviewStatus === 'submitted'
    ? Math.max(0, Math.round((Date.parse(db.TODAY) - Date.parse(toThaiTimeParts(submittedAt).date)) / 86_400_000))
    : undefined

  return { worklog, studentId, studentName, submittedAt, pendingDays, isOverdue: (pendingDays ?? 0) > db.settings.reviewOverdueDays }
}

/** ช่วง "ไม่อยู่" ที่ครอบคลุมเวลา now เรียงตามเวลาเริ่ม อนุมัติแทนได้เฉพาะช่วงเหล่านี้ */
export function activeAbsences(now: string) {
  const at = Date.parse(now)
  return db.absences
    .filter(item => item.type === 'absent' && !item.cancelledAt && Date.parse(item.startAt) <= at && at < Date.parse(item.endAt))
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
}

export interface Reviewable {
  student: { studentId: string, name: string }
  worklog: WorkLog
}

interface ReviewRequest {
  targets: ReviewTarget[]
  decision: 'approved' | 'returned'
  comment?: string
  allowTimeEdit?: boolean
  reviewer: UserProfile
  /** แอดมินอนุมัติแทนพี่เลี้ยงคนนี้ */
  proxyFor?: UserProfile
  /** เวลาเซิร์ฟเวอร์ที่ตรวจ */
  at: string
  /** รายการที่ผู้ตรวจมีสิทธิ์ ไม่มีสิทธิ์คืน undefined */
  find: (id: number) => Reviewable | undefined
  denied: string
}

/** อนุมัติหรือส่งกลับทีละรายการ รายการที่ทำไม่ได้จะแจ้งเหตุผลกลับไป */
export function reviewWorklogs({ targets, decision, comment, allowTimeEdit, reviewer, proxyFor, at, find, denied }: ReviewRequest): ReviewResult {
  const result: ReviewResult = { succeededIds: [], failures: [] }

  for (const { id, version } of targets) {
    const found = find(id)
    const problem = !found
      ? denied
      : found.worklog.reviewStatus !== 'submitted'
        ? 'รายการนี้ไม่ได้อยู่ในสถานะรอตรวจแล้ว'
        : found.worklog.version !== version ? 'รายการถูกแก้ไขหลังจากที่เปิดดู กรุณาตรวจใหม่' : undefined

    if (!found || problem) {
      result.failures.push({ id, message: problem! })
      continue
    }

    Object.assign(found.worklog, { reviewStatus: decision, reviewComment: comment, reviewedBy: reviewer.name, proxyFor: proxyFor?.name, reviewedAt: at, timeEditAllowed: allowTimeEdit || undefined, version: version + 1 })

    const approvalTitle = proxyFor
      ? `อนุมัติแทน ${proxyFor.name}${comment ? `: ${comment}` : ''}`
      : comment ? `อนุมัติ: ${comment}` : 'ผู้อนุมัติ'
    appendHistory(id, decision === 'approved'
      ? { type: 'approval', title: approvalTitle, actorName: reviewer.name, before: 'รอตรวจ', after: 'อนุมัติแล้ว' }
      : { type: 'return', title: `ส่งกลับ${allowTimeEdit ? ' (เปิดให้แก้เวลา)' : ''}: ${comment}`, actorName: reviewer.name, before: 'รอตรวจ', after: 'ส่งกลับแก้ไข' }, at)

    addNotification(decision, found.student, found.worklog, at)
    // พี่เลี้ยงต้องรู้ว่ามีการอนุมัติแทน
    if (proxyFor) addNotification('proxy_approved', found.student, found.worklog, at)
    result.succeededIds.push(id)
  }

  return result
}
