import type { AuthApi } from '~/types/auth'
import type { ReviewItem, ReviewResult, ReviewTarget } from '~/types/review'
import type { Attachment, HistoryEvent, SaveWorklogInput, UserRole, WeeklyReportData, WorkLog } from '~/types/worklog'
import { addDays, formatThaiDate, toThaiTimeParts } from '~/utils/date'
import { fileError } from '~/utils/attachments'
import { toMinutes } from '~/utils/time'
import { findOverlaps, overlapMessage, startTimeError, timeRangeError } from '~/utils/worklogRules'
import { ApiError, type Api } from './api'
import { createMockAuth, currentAccount, requireRole } from './mockAuth'
import type { MockSession } from './mockSession'
import * as db from './mockData'

// ข้อมูลอยู่ในหน่วยความจำ การเปลี่ยนแปลงหายเมื่อโหลดหน้าเว็บใหม่
let nextId = 1000

/** จำลองเวลารอเครือข่าย และคืนสำเนาข้อมูลเหมือนรับจากเซิร์ฟเวอร์ */
async function respond<T>(data: T): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, 150))
  return structuredClone(data)
}

function findWorklog(id: number) {
  const worklog = db.studentWorklogs.find(item => item.id === id)
  if (worklog) return worklog
  // รายการของนักศึกษาคนอื่น (ขอบเขตงานข้อ 2.3)
  if (db.otherStudents.some(other => other.worklogs.some(item => item.id === id))) {
    throw new ApiError('รายการที่ขออยู่นอกขอบเขตข้อมูลที่คุณมีสิทธิ์ดู', 403)
  }
  throw new ApiError('ไม่พบรายการงานนี้', 404)
}

/** เวลาเซิร์ฟเวอร์จำลอง: วันที่ตัวอย่าง + เวลาจริงตามเขตเวลาไทย */
function serverNow() {
  return `${db.TODAY}T${toThaiTimeParts(new Date().toISOString()).time}:00+07:00`
}

/** ฉบับร่างและรายการที่ถูกส่งกลับ แก้ไขได้เฉพาะภายในช่วงย้อนหลัง (นับทุกวัน) */
function isOutsideEditWindow(worklog: WorkLog) {
  return worklog.date < addDays(db.TODAY, -db.BACKDATE_LIMIT_DAYS)
}

function withPermissions(worklogs: WorkLog[]) {
  return worklogs.map(worklog => ({ ...worklog, canEdit: ['draft', 'returned'].includes(worklog.reviewStatus) && !isOutsideEditWindow(worklog) }))
}

/** แก้ไข/ลบได้เฉพาะฉบับร่างหรือถูกส่งกลับ (ขอบเขตงานข้อ 8.4) */
function assertEditable(worklog: WorkLog) {
  if (worklog.reviewStatus !== 'draft' && worklog.reviewStatus !== 'returned') {
    throw new ApiError('รายการที่ส่งตรวจหรืออนุมัติแล้ว แก้ไขหรือลบไม่ได้', 409)
  }
}

function weekly(student: { studentId: string, name: string, worklogs: WorkLog[] }, weekStart: string, includeDrafts: boolean): WeeklyReportData {
  const weekEnd = addDays(weekStart, 6)
  return {
    studentId: student.studentId,
    name: student.name,
    mentorName: db.mentor.name,
    worklogs: student.worklogs.filter(log => log.date >= weekStart && log.date <= weekEnd && (includeDrafts || log.reviewStatus !== 'draft')),
  }
}

/** นักศึกษาในความดูแลของพี่เลี้ยง (ขอบเขตงานข้อ 9.2) */
function mentoredStudents() {
  return [
    { studentId: db.student.studentId!, name: db.student.name, worklogs: db.studentWorklogs },
    ...db.otherStudents,
  ]
}

function validate(input: SaveWorklogInput) {
  if (!input.title.trim() || !input.description.trim()) throw new ApiError('กรุณากรอกหัวข้องานและรายละเอียด', 422)
  if (input.endTime && !input.startTime) throw new ApiError('กรุณากรอกเวลาเริ่ม', 422)
  if (input.startTime) {
    const timeError = startTimeError(input.startTime, db.internship.workEndTime)
      ?? (input.endTime ? timeRangeError(input.startTime, input.endTime, db.internship.workEndTime) : undefined)
    if (timeError) throw new ApiError(timeError, 422)
    const sameDay = db.studentWorklogs.filter(log => log.date === input.date)
    const overlap = findOverlaps(sameDay, input.startTime, input.endTime, input.id)[0]
    if (overlap) throw new ApiError(overlapMessage(overlap), 409)
  }
  if (input.date < db.internship.startDate || input.date > db.internship.endDate) throw new ApiError('วันที่อยู่นอกช่วงฝึกงาน', 422)
  if (input.mode === 'backdate' && (input.date < addDays(db.TODAY, -db.BACKDATE_LIMIT_DAYS) || input.date > db.TODAY)) {
    throw new ApiError('วันที่อยู่นอกช่วงย้อนหลังที่อนุญาต', 422)
  }
  const invalid = input.newFiles.map(fileError).find(Boolean)
  if (invalid) throw new ApiError(invalid, 422)
  if (input.submit && !input.endTime) throw new ApiError('ต้องบันทึกเวลาสิ้นสุดก่อนส่งตรวจ', 422)
  if (input.submit && !input.keepAttachmentIds.length && !input.newFiles.length) throw new ApiError('กรุณาแนบไฟล์หลักฐานอย่างน้อย 1 ไฟล์', 422)
}

/** รายการของนักศึกษาในความดูแลที่ส่งเข้ามาแล้ว (ไม่รวมฉบับร่าง) */
function findReviewable(id: number) {
  for (const student of mentoredStudents()) {
    const worklog = student.worklogs.find(item => item.id === id)
    if (worklog && worklog.reviewStatus !== 'draft') return { student, worklog }
  }
  return undefined
}

function toReviewItem(studentId: string, studentName: string, worklog: WorkLog): ReviewItem {
  const submittedAt = worklog.submittedAt!
  const pendingDays = worklog.reviewStatus === 'submitted'
    ? Math.max(0, Math.round((Date.parse(db.TODAY) - Date.parse(toThaiTimeParts(submittedAt).date)) / 86_400_000))
    : undefined

  return { worklog, studentId, studentName, submittedAt, pendingDays, isOverdue: (pendingDays ?? 0) > db.REVIEW_OVERDUE_DAYS }
}

function addHistory(worklogId: number, event: Omit<HistoryEvent, 'id' | 'changedAt'>) {
  db.histories[worklogId] = [{ ...event, id: nextId++, changedAt: serverNow() }, ...db.histories[worklogId] ?? []]
}

/** อนุมัติหรือส่งกลับทีละรายการ รายการที่ทำไม่ได้จะแจ้งเหตุผลกลับไป */
async function review(targets: ReviewTarget[], decision: 'approved' | 'returned', comment?: string): Promise<ReviewResult> {
  const result: ReviewResult = { succeededIds: [], failures: [] }

  for (const { id, version } of targets) {
    const found = findReviewable(id)
    const problem = !found
      ? 'ไม่มีสิทธิ์ตรวจรายการนี้'
      : found.worklog.reviewStatus !== 'submitted'
        ? 'รายการนี้ไม่ได้อยู่ในสถานะรอตรวจแล้ว'
        : found.worklog.version !== version ? 'รายการถูกแก้ไขหลังจากที่เปิดดู กรุณาตรวจใหม่' : undefined

    if (!found || problem) {
      result.failures.push({ id, message: problem! })
      continue
    }

    Object.assign(found.worklog, { reviewStatus: decision, reviewComment: comment, reviewedBy: db.mentor.name, reviewedAt: serverNow(), version: version + 1 })
    addHistory(id, decision === 'approved'
      ? { type: 'approval', title: comment ? `อนุมัติ: ${comment}` : 'ผู้อนุมัติ', actorName: db.mentor.name, before: 'รอตรวจ', after: 'อนุมัติ' }
      : { type: 'return', title: `ส่งกลับ: ${comment}`, actorName: db.mentor.name, before: 'รอตรวจ', after: 'ส่งกลับแก้ไข' })
    result.succeededIds.push(id)
  }

  return respond(result)
}

/** สรุปฟิลด์ที่เปลี่ยน สำหรับแสดงข้อมูลก่อนและหลังแก้ไข */
function describeChange(before: WorkLog, after: WorkLog) {
  const fields: [string, (log: WorkLog) => string][] = [
    ['วันที่', log => formatThaiDate(log.date)],
    ['เวลา', log => `${log.startTime ?? '–'}–${log.endTime ?? '–'}`],
    ['หัวข้องาน', log => log.title],
    ['รายละเอียด', log => log.description ?? '–'],
    ['ไฟล์แนบ', log => log.attachments?.map(file => file.name).join(', ') || 'ไม่มีไฟล์'],
  ]
  const changed = fields.filter(([, value]) => value(before) !== value(after))
  if (!changed.length) return undefined

  const summary = (log: WorkLog) => changed.map(([label, value]) => `${label}: ${value(log)}`).join(' · ')
  return {
    title: `แก้ไข${changed.map(([label]) => label).join(', ')}`,
    before: summary(before),
    after: summary(after),
  }
}

const dataApi: Omit<Api, keyof AuthApi> = {
  getDashboard: () => respond({
    internship: db.internship,
    summary: db.dashboardSummary,
    recentWorklogs: withPermissions(db.dashboardWorklogs.map(item => db.studentWorklogs.find(log => log.id === item.id) ?? item)),
  }),

  getInternship: () => respond(db.internship),

  getDailyWorklogs: (date = db.DAILY_DATE) => respond({
    date,
    semester: db.internship.semester,
    worklogs: withPermissions(db.studentWorklogs.filter(log => log.date === date)),
    mentorUnavailable: db.unavailabilities.find(range => range.date === date),
  }),

  listWorklogs: (from, to) => respond(db.studentWorklogs.filter(log => log.date >= from && log.date <= to)),

  getReturnedWorklogs: () => respond(withPermissions(db.studentWorklogs
    .filter(log => log.reviewStatus === 'returned')
    .sort((a, b) => Date.parse(b.reviewedAt ?? b.date) - Date.parse(a.reviewedAt ?? a.date)))),

  getWorklog: async id => respond(withPermissions([findWorklog(id)])[0]!),

  getDraftWorklogs: () => respond(withPermissions(db.studentWorklogs
    .filter(log => log.reviewStatus === 'draft')
    .sort((a, b) => b.date.localeCompare(a.date)))),

  getWorklogFormContext: mode => respond({
    today: db.TODAY,
    backdateLimitDays: db.BACKDATE_LIMIT_DAYS,
    workEndTime: db.internship.workEndTime,
    internshipStart: db.internship.startDate,
    internshipEnd: db.internship.endDate,
    // รายการใหม่เริ่มนับเวลาตั้งแต่เปิดฟอร์ม
    defaults: mode === 'new'
      ? { ...db.formDefaults.new, startTime: toThaiTimeParts(serverNow()).time }
      : db.formDefaults.backdate,
  }),

  getServerTime: () => respond(serverNow()),

  async saveWorklog(input) {
    validate(input)

    const existing = input.id ? findWorklog(input.id) : undefined
    if (existing) {
      assertEditable(existing)
      if (isOutsideEditWindow(existing)) throw new ApiError('รายการนี้เกินช่วงย้อนหลังแล้ว แก้ไขและส่งตรวจไม่ได้', 409)
    }

    // ไฟล์เดิมมาจากรายการที่บันทึกไว้ หรือไฟล์ตัวอย่างในฟอร์ม (รวมแบบไม่ให้ id ซ้ำ)
    const known: Attachment[] = [...new Map(
      [...db.formDefaults[input.mode].attachments, ...(existing?.attachments ?? [])].map(file => [file.id, file]),
    ).values()]
    const uploaded: Attachment[] = input.newFiles.map(file => ({
      id: nextId++,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url: URL.createObjectURL(file),
    }))

    const saved: WorkLog = {
      id: existing?.id ?? nextId++,
      date: input.date,
      title: input.title.trim(),
      description: input.description.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      workStatus: input.endTime ? 'done' : input.startTime ? 'in_progress' : 'pending',
      reviewStatus: input.submit ? 'submitted' : existing?.reviewStatus ?? 'draft',
      submittedAt: input.submit ? serverNow() : existing?.submittedAt,
      reviewComment: input.submit ? undefined : existing?.reviewComment,
      reviewedBy: input.submit ? undefined : existing?.reviewedBy,
      reviewedAt: input.submit ? undefined : existing?.reviewedAt,
      version: (existing?.version ?? 0) + 1,
      attachments: [...known.filter(file => input.keepAttachmentIds.includes(file.id)), ...uploaded],
    }

    if (existing) db.studentWorklogs.splice(db.studentWorklogs.indexOf(existing), 1, saved)
    else db.studentWorklogs.push(saved)
    // เก็บประวัติการแก้ไขข้อมูลก่อนและหลัง (ขอบเขตงานข้อ 8.2)
    const change = existing ? describeChange(existing, saved) : undefined
    if (change) addHistory(saved.id, { type: 'edit', actorName: db.student.name, ...change })
    if (input.submit) {
      addHistory(saved.id, { type: 'status', title: 'ส่งตรวจ', actorName: db.student.name, before: existing?.reviewStatus === 'returned' ? 'ส่งกลับแก้ไข' : 'ฉบับร่าง', after: 'รอตรวจ' })
    }

    return respond(saved)
  },

  async deleteWorklog(id, reason) {
    const worklog = findWorklog(id)
    assertEditable(worklog)
    if (!reason.trim()) throw new ApiError('กรุณาระบุเหตุผล', 422)
    db.studentWorklogs.splice(db.studentWorklogs.indexOf(worklog), 1)
    await respond(null)
  },

  getWorklogHistory: async id => respond({ worklog: findWorklog(id), events: db.histories[id] ?? [] }),

  getMyWeeklyReport: weekStart => respond(weekly(mentoredStudents()[0]!, weekStart, true)),

  getMentorStudents: () => respond(mentoredStudents().map(({ studentId, name }) => ({ studentId, name }))),

  getMentorWeeklyReports: (weekStart, studentId) => respond(mentoredStudents()
    .filter(student => !studentId || student.studentId === studentId)
    // ฉบับร่างยังไม่ถูกส่งตรวจ พี่เลี้ยงจึงไม่เห็น
    .map(student => weekly(student, weekStart, false))),

  getReviewQueue(filter, limit) {
    const items = mentoredStudents().flatMap(student => student.worklogs
      .filter(log => filter === 'all' ? log.reviewStatus !== 'draft' : log.reviewStatus === 'submitted')
      .map(log => toReviewItem(student.studentId, student.name, log)))
    items.sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt))
    if (filter === 'all') items.reverse()

    return respond({
      items: items.slice(0, limit),
      total: items.length,
      pendingCount: mentoredStudents().flatMap(student => student.worklogs).filter(log => log.reviewStatus === 'submitted').length,
      overdueDays: db.REVIEW_OVERDUE_DAYS,
    })
  },

  approveWorklogs: (targets, comment) => review(targets, 'approved', comment?.trim() || undefined),

  async returnWorklogs(targets, comment) {
    if (!comment.trim()) throw new ApiError('กรุณาระบุความคิดเห็นเมื่อส่งกลับแก้ไข', 422)
    return review(targets, 'returned', comment.trim())
  },

  async createUnavailability(input) {
    if (!input.reason.trim()) throw new ApiError('กรุณาระบุเหตุผล', 422)
    if (input.date < db.TODAY) throw new ApiError('ไม่สามารถแจ้งวันที่ผ่านมาแล้ว', 422)
    if (toMinutes(input.endTime) <= toMinutes(input.startTime)) throw new ApiError('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม', 422)
    const overlaps = db.unavailabilities.some(range => range.date === input.date
      && toMinutes(input.startTime) < toMinutes(range.endTime) && toMinutes(range.startTime) < toMinutes(input.endTime))
    if (overlaps) throw new ApiError('ช่วงเวลานี้ซ้อนกับที่แจ้งไว้แล้ว', 409)
    db.unavailabilities.push({ ...input, reason: input.reason.trim() })
    await respond(null)
  },
}

/** ตรวจ session และบทบาทก่อนเรียกข้อมูล เหมือนที่ backend ต้องทำ (ขอบเขตงานข้อ 2.2, 2.3) */
export function createMockApi(session: MockSession): Api {
  const guard = <Args extends unknown[], Result>(role: UserRole, method: (...args: Args) => Promise<Result>) =>
    async (...args: Args) => {
      requireRole(session, role)
      return method(...args)
    }

  /** นักศึกษาดูของตนเอง พี่เลี้ยงดูของนักศึกษาในความดูแล (ขอบเขตงานข้อ 2.3) */
  async function getWorklogHistory(id: number) {
    if (currentAccount(session).profile.role !== 'supervisor') {
      requireRole(session, 'student')
      return dataApi.getWorklogHistory(id)
    }
    const found = findReviewable(id)
    if (!found) throw new ApiError('รายการที่ขออยู่นอกขอบเขตข้อมูลที่คุณมีสิทธิ์ดู', 403)
    return respond({ worklog: found.worklog, events: db.histories[id] ?? [] })
  }

  return {
    ...createMockAuth(session),

    getDashboard: guard('student', dataApi.getDashboard),
    getInternship: guard('student', dataApi.getInternship),
    getDailyWorklogs: guard('student', dataApi.getDailyWorklogs),
    listWorklogs: guard('student', dataApi.listWorklogs),
    getReturnedWorklogs: guard('student', dataApi.getReturnedWorklogs),
    getWorklog: guard('student', dataApi.getWorklog),
    getDraftWorklogs: guard('student', dataApi.getDraftWorklogs),
    getWorklogFormContext: guard('student', dataApi.getWorklogFormContext),
    // ต้องเข้าสู่ระบบ แต่ไม่จำกัดบทบาท
    getServerTime: async () => {
      currentAccount(session)
      return dataApi.getServerTime()
    },
    saveWorklog: guard('student', dataApi.saveWorklog),
    deleteWorklog: guard('student', dataApi.deleteWorklog),
    getWorklogHistory,
    getMyWeeklyReport: guard('student', dataApi.getMyWeeklyReport),

    getMentorStudents: guard('supervisor', dataApi.getMentorStudents),
    getMentorWeeklyReports: guard('supervisor', dataApi.getMentorWeeklyReports),
    getReviewQueue: guard('supervisor', dataApi.getReviewQueue),
    approveWorklogs: guard('supervisor', dataApi.approveWorklogs),
    returnWorklogs: guard('supervisor', dataApi.returnWorklogs),
    createUnavailability: guard('supervisor', dataApi.createUnavailability),
  }
}
