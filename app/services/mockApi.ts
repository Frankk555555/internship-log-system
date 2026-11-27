import type { AuthApi } from '~/types/auth'
import type { ReviewItem, ReviewResult, ReviewTarget } from '~/types/review'
import type { Attachment, HistoryEvent, SaveWorklogInput, UserRole, WeeklyReportData, WorkLog } from '~/types/worklog'
import { addDays, formatThaiDate, toThaiTimeParts } from '~/utils/date'
import { fileError } from '~/utils/attachments'
import { toMinutes } from '~/utils/time'
import { earliestEntryDate, editDeadline, findOverlaps, futureTimeError, isAfterWork, overlapMessage, startTimeError, timePolicy, timerFinishError, timerStartError, timeRangeError } from '~/utils/worklogRules'
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

/** เวลาเซิร์ฟเวอร์จำลอง: วันนี้ + เวลาจริงตามเขตเวลาไทย */
function serverNow() {
  const now = new Date()
  const seconds = String(now.getUTCSeconds()).padStart(2, '0')
  return `${db.TODAY}T${toThaiTimeParts(now.toISOString()).time}:${seconds}+07:00`
}

function isAfterWorkNow() {
  return isAfterWork(toThaiTimeParts(serverNow()).time, db.internship.workEndTime)
}

/** ฉบับร่างและรายการที่ถูกส่งกลับ เลยกำหนดแก้ไขแล้วหรือยัง (นับทุกวัน) */
function isOutsideEditWindow(worklog: WorkLog) {
  return db.TODAY > editDeadline(worklog, db.BACKDATE_LIMIT_DAYS)
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
  const { company, position, startDate, endDate } = db.internship
  return [
    { studentId: db.student.studentId!, name: db.student.name, email: db.student.email, company, position, startDate, endDate, worklogs: db.studentWorklogs },
    ...db.otherStudents,
  ]
}

/** งานของวันนี้ที่เริ่มแล้วแต่ยังไม่เสร็จ */
function findRunning(excludeId?: number) {
  return db.studentWorklogs.find(log => log.date === db.TODAY && log.startTime && !log.endTime && log.id !== excludeId)
}

function runningError(running: WorkLog) {
  const action = isAfterWorkNow() ? 'กรุณากรอกเวลาสิ้นสุดของงานนั้นในหน้าแก้ไขก่อน' : 'กรุณากด "ทำงานเสร็จสิ้น" ก่อน'
  return new ApiError(`มีงานกำลังดำเนินการอยู่: “${running.title}” ${action}`, 409)
}

/** จับเวลาได้ครั้งละหนึ่งงาน ทุกทางที่บันทึกเวลา (5.7) */
function assertSingleTimer(input: SaveWorklogInput) {
  const running = findRunning(input.id)
  if (!running || input.date !== db.TODAY) return

  const startsNewTimer = (input.mode === 'new' && !input.id) || (input.startTime && !input.endTime)
  // งานที่จับเวลาอยู่กินช่วงตั้งแต่เวลาเริ่มจนถึงตอนนี้
  const overlapsRunning = input.endTime && toMinutes(input.endTime) > toMinutes(running.startTime!)
  if (startsNewTimer || overlapsRunning) throw runningError(running)
}

function validate(input: SaveWorklogInput) {
  if (!input.title.trim() || !input.description.trim()) throw new ApiError('กรุณากรอกหัวข้องานและรายละเอียด', 422)
  if (input.endTime && !input.startTime) throw new ApiError('กรุณากรอกเวลาเริ่ม', 422)
  if (input.startTime) {
    const now = toThaiTimeParts(serverNow())
    const timeError = startTimeError(input.startTime, db.internship)
      ?? (input.endTime ? timeRangeError(input.startTime, input.endTime, db.internship) : undefined)
      ?? futureTimeError(input.date, input.endTime ?? input.startTime, now)
    if (timeError) throw new ApiError(timeError, 422)
    const sameDay = db.studentWorklogs.filter(log => log.date === input.date)
    const overlap = findOverlaps(sameDay, input.startTime, input.endTime, input.id)[0]
    if (overlap) throw new ApiError(overlapMessage(overlap), 409)
  }
  assertSingleTimer(input)
  if (input.date < db.internship.startDate || input.date > db.internship.endDate) throw new ApiError('วันที่อยู่นอกช่วงฝึกงาน', 422)
  const existing = db.studentWorklogs.find(log => log.id === input.id)
  const earliest = earliestEntryDate(existing, db.TODAY, db.BACKDATE_LIMIT_DAYS)
  if (input.mode === 'backdate' && (input.date < earliest || input.date > db.TODAY)) {
    throw new ApiError('วันที่อยู่นอกช่วงย้อนหลังที่อนุญาต', 422)
  }
  const invalid = input.newFiles.map(fileError).find(Boolean)
  if (invalid) throw new ApiError(invalid, 422)
  if (input.submit && !input.endTime) throw new ApiError('ต้องบันทึกเวลาสิ้นสุดก่อนส่งตรวจ', 422)
  if (input.submit && !input.keepAttachmentIds.length && !input.newFiles.length) throw new ApiError('กรุณาแนบไฟล์หลักฐานอย่างน้อย 1 ไฟล์', 422)
}

/** กันการแก้เวลาที่ล็อกไว้ และตรวจเวลาของรายการที่ระบบจับเวลา */
function assertTimeRules(input: SaveWorklogInput, existing?: WorkLog) {
  const now = toThaiTimeParts(serverNow()).time
  const isFuture = (time?: string) => Boolean(time) && toMinutes(time!) > toMinutes(now)

  if (!existing) {
    if (input.mode === 'new' && (input.date !== db.TODAY || isFuture(input.startTime) || isFuture(input.endTime))) {
      throw new ApiError('รายการใหม่ต้องเป็นของวันนี้และเวลาไม่เกินเวลาปัจจุบัน', 422)
    }
    return
  }

  const policy = timePolicy(existing, db.TODAY, isAfterWorkNow())
  // กดทำงานเสร็จสิ้น: เติมเวลาสิ้นสุดของร่างวันนี้ ไม่เกินเวลาปัจจุบัน
  const isFinishing = existing.reviewStatus === 'draft' && !existing.endTime && input.date === db.TODAY
    && Boolean(input.endTime) && !isFuture(input.endTime)

  if ((input.date !== existing.date && !policy.date)
    || (input.startTime !== existing.startTime && !policy.start)
    || (input.endTime !== existing.endTime && !policy.end && !isFinishing)) {
    throw new ApiError('วันที่และเวลาของรายการนี้ถูกล็อก แก้ไขไม่ได้', 409)
  }
}

/** ที่มาของเวลา และการแก้เวลาหลังถูกส่งกลับ เพื่อให้พี่เลี้ยงเห็น */
function timeFlags(input: SaveWorklogInput, existing?: WorkLog) {
  if (!existing) {
    const timeSource: WorkLog['timeSource'] = input.mode === 'new' ? 'timer' : input.startTime ? 'manual' : undefined
    return { timeSource, timeEdited: undefined }
  }

  const changed = input.date !== existing.date || input.startTime !== existing.startTime || input.endTime !== existing.endTime
  const missedFinish = existing.date < db.TODAY || (existing.date === db.TODAY && isAfterWorkNow())
  const forgotFinish = existing.timeSource === 'timer' && !existing.endTime && Boolean(input.endTime) && missedFinish
  const timeSource: WorkLog['timeSource'] = forgotFinish
    ? 'timer_manual_end'
    : existing.timeSource ?? (existing.reviewStatus === 'draft' && changed ? 'manual' : undefined)

  return { timeSource, timeEdited: existing.timeEdited || (existing.reviewStatus === 'returned' && changed) || undefined }
}

/** ฉบับร่างของนักศึกษาที่ยังอยู่ในช่วงแก้ไขได้ */
function findDraft(id: number) {
  const worklog = findWorklog(id)
  if (worklog.reviewStatus !== 'draft') throw new ApiError('เริ่มหรือจบงานได้เฉพาะฉบับร่าง', 409)
  if (isOutsideEditWindow(worklog)) throw new ApiError('รายการนี้เกินช่วงย้อนหลังแล้ว', 409)
  return worklog
}

/** รายการของนักศึกษาในความดูแลที่ส่งเข้ามาแล้ว (ไม่รวมฉบับร่าง) */
function findReviewable(id: number) {
  for (const student of mentoredStudents()) {
    const worklog = student.worklogs.find(item => item.id === id)
    if (worklog && worklog.reviewStatus !== 'draft') return { student, worklog }
  }
  return undefined
}

/** รายการที่พี่เลี้ยงส่งกลับแล้วนักศึกษาลบ (ฉบับร่างที่ไม่เคยส่งตรวจ พี่เลี้ยงไม่เห็น) */
function deletedReturns() {
  return db.deletedWorklogs.filter(item => item.worklog.reviewStatus === 'returned')
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
async function review(targets: ReviewTarget[], decision: 'approved' | 'returned', comment?: string, allowTimeEdit?: boolean): Promise<ReviewResult> {
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

    Object.assign(found.worklog, { reviewStatus: decision, reviewComment: comment, reviewedBy: db.mentor.name, reviewedAt: serverNow(), timeEditAllowed: allowTimeEdit || undefined, version: version + 1 })
    addHistory(id, decision === 'approved'
      ? { type: 'approval', title: comment ? `อนุมัติ: ${comment}` : 'ผู้อนุมัติ', actorName: db.mentor.name, before: 'รอตรวจ', after: 'อนุมัติแล้ว' }
      : { type: 'return', title: `ส่งกลับ${allowTimeEdit ? ' (เปิดให้แก้เวลา)' : ''}: ${comment}`, actorName: db.mentor.name, before: 'รอตรวจ', after: 'ส่งกลับแก้ไข' })
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

function runningSummary() {
  const running = findRunning()
  return running && { id: running.id, title: running.title, startTime: running.startTime! }
}

const dataApi: Omit<Api, keyof AuthApi> = {
  getDashboard: () => {
    const count = (status: WorkLog['reviewStatus']) => db.studentWorklogs.filter(log => log.reviewStatus === status).length

    return respond({
      today: db.TODAY,
      internship: db.internship,
      summary: { approvedCount: count('approved'), waitingReviewCount: count('submitted'), returnedCount: count('returned') },
      // ใหม่สุดก่อน วันเดียวกันให้รายการที่ยังไม่เริ่มอยู่บนสุด แล้วเรียงตามเวลาเริ่มจากหลังไปหน้า
      recentWorklogs: withPermissions([...db.studentWorklogs].sort((a, b) => b.date.localeCompare(a.date)
        || (b.startTime ?? '99:99').localeCompare(a.startTime ?? '99:99'))),
    })
  },

  getInternship: () => respond(db.internship),

  getDailyWorklogs: (date = db.TODAY) => respond({
    date,
    semester: db.internship.semester,
    worklogs: withPermissions(db.studentWorklogs.filter(log => log.date === date)),
    mentorUnavailable: db.unavailabilities.find(range => range.date === date),
  }),

  listWorklogs: (from, to) => respond(withPermissions(db.studentWorklogs.filter(log => log.date >= from && log.date <= to))),

  getWorklog: async id => respond(withPermissions([findWorklog(id)])[0]!),

  getWorklogFormContext: mode => respond({
    today: db.TODAY,
    runningWorklog: runningSummary(),
    backdateLimitDays: db.BACKDATE_LIMIT_DAYS,
    workStartTime: db.internship.workStartTime,
    workEndTime: db.internship.workEndTime,
    internshipStart: db.internship.startDate,
    internshipEnd: db.internship.endDate,
    // ฟอร์มเปิดมาว่าง รายการใหม่เริ่มนับเวลาตั้งแต่เปิดฟอร์ม ส่วนย้อนหลังให้ผู้ใช้เลือกวันเอง
    defaults: {
      date: mode === 'new' ? db.TODAY : '',
      startTime: mode === 'new' ? toThaiTimeParts(serverNow()).time : undefined,
      title: '',
      description: '',
      attachments: [],
    },
  }),

  getServerTime: () => respond(serverNow()),

  async saveWorklog(input) {
    validate(input)

    const existing = input.id ? findWorklog(input.id) : undefined
    if (existing) {
      assertEditable(existing)
      if (isOutsideEditWindow(existing)) throw new ApiError('รายการนี้เลยกำหนดแก้ไขแล้ว แก้ไขและส่งตรวจไม่ได้', 409)
    }
    assertTimeRules(input, existing)

    // ไฟล์เดิมมาจากรายการที่บันทึกไว้
    const known = existing?.attachments ?? []
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
      timeEditAllowed: input.submit ? undefined : existing?.timeEditAllowed,
      ...timeFlags(input, existing),
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

  async startWorklog(id) {
    const worklog = findDraft(id)
    if (worklog.startTime) throw new ApiError('รายการนี้เริ่มงานแล้ว', 409)

    const now = toThaiTimeParts(serverNow()).time
    if (db.TODAY < db.internship.startDate || db.TODAY > db.internship.endDate) throw new ApiError('วันนี้อยู่นอกช่วงฝึกงาน', 422)
    const outsideHours = timerStartError(now, db.internship)
    if (outsideHours) throw new ApiError(outsideHours, 422)

    // จับเวลาได้ครั้งละหนึ่งงาน ไม่ให้ช่วงเวลาซ้อนกัน (5.7)
    const running = findRunning(id)
    if (running) throw runningError(running)
    const todayLogs = db.studentWorklogs.filter(log => log.date === db.TODAY && log.id !== id)
    const overlap = findOverlaps(todayLogs, now)[0]
    if (overlap) throw new ApiError(overlapMessage(overlap), 409)

    // งานนับเป็นของวันที่ลงมือทำ
    const previousDate = worklog.date
    Object.assign(worklog, { date: db.TODAY, startTime: now, workStatus: 'in_progress', timeSource: 'timer', version: (worklog.version ?? 0) + 1 })
    addHistory(id, {
      type: 'status',
      title: 'รอดำเนินการ → กำลังดำเนินการ',
      actorName: db.student.name,
      before: previousDate === db.TODAY ? 'รอดำเนินการ' : `รอดำเนินการ · วันที่: ${formatThaiDate(previousDate)}`,
      after: previousDate === db.TODAY ? 'กำลังดำเนินการ' : `กำลังดำเนินการ · วันที่: ${formatThaiDate(db.TODAY)}`,
    })
    return respond(worklog)
  },

  async finishWorklog(id) {
    const worklog = findDraft(id)
    if (!worklog.startTime || worklog.endTime) throw new ApiError('รายการนี้ไม่ได้อยู่ระหว่างดำเนินการ', 409)
    // งานต้องเสร็จภายในวันเดียวกัน
    if (worklog.date !== db.TODAY) throw new ApiError('บันทึกเวลาสิ้นสุดข้ามวันไม่ได้ กรุณากรอกเวลาสิ้นสุดในหน้าแก้ไขรายการ', 409)

    const now = toThaiTimeParts(serverNow()).time
    const timeError = timerFinishError(now, db.internship) ?? timeRangeError(worklog.startTime, now, db.internship)
    if (timeError) throw new ApiError(timeError, 422)
    const overlap = findOverlaps(db.studentWorklogs.filter(log => log.date === db.TODAY), worklog.startTime, now, id)[0]
    if (overlap) throw new ApiError(overlapMessage(overlap), 409)

    Object.assign(worklog, { endTime: now, workStatus: 'done', version: (worklog.version ?? 0) + 1 })
    addHistory(id, { type: 'status', title: 'กำลังดำเนินการ → เสร็จสิ้น', actorName: db.student.name, before: 'กำลังดำเนินการ', after: 'เสร็จสิ้น' })
    return respond(worklog)
  },

  async deleteWorklog(id, reason) {
    const worklog = findWorklog(id)
    assertEditable(worklog)
    if (!reason.trim()) throw new ApiError('กรุณาระบุเหตุผล', 422)
    // ย้ายออกจากรายการใช้งาน แต่เก็บข้อมูลและประวัติไว้ (ขอบเขตงานข้อ 8.2)
    db.studentWorklogs.splice(db.studentWorklogs.indexOf(worklog), 1)
    const deletion = { deletedAt: serverNow(), deletedBy: db.student.name, reason: reason.trim() }
    db.deletedWorklogs.unshift({ studentId: db.student.studentId!, studentName: db.student.name, worklog: { ...worklog, deletion } })
    addHistory(id, {
      type: 'delete',
      title: `ลบรายการ: ${deletion.reason}`,
      actorName: db.student.name,
      before: worklog.reviewStatus === 'returned' ? 'ส่งกลับแก้ไข' : 'ฉบับร่าง',
      after: 'ถูกลบ',
    })
    await respond(null)
  },

  getWorklogHistory: async (id) => {
    const worklog = db.deletedWorklogs.find(item => item.worklog.id === id)?.worklog ?? findWorklog(id)
    return respond({ worklog, events: db.histories[id] ?? [] })
  },

  getMyWeeklyReport: weekStart => respond(weekly(mentoredStudents()[0]!, weekStart, true)),

  getMentorStudents: () => respond(mentoredStudents().map(({ studentId, name }) => ({ studentId, name }))),

  getMentorWeeklyReports: (weekStart, studentId) => respond(mentoredStudents()
    .filter(student => !studentId || student.studentId === studentId)
    // ฉบับร่างยังไม่ถูกส่งตรวจ พี่เลี้ยงจึงไม่เห็น
    .map(student => weekly(student, weekStart, false))),

  getSupervisedStudents: () => respond({
    overdueDays: db.REVIEW_OVERDUE_DAYS,
    students: mentoredStudents().map(({ worklogs, ...profile }) => {
      const withStatus = (status: WorkLog['reviewStatus']) => worklogs.filter(log => log.reviewStatus === status)
      const waiting = withStatus('submitted').map(log => toReviewItem(profile.studentId, profile.name, log))
      const submittedTimes = worklogs.flatMap(log => log.reviewStatus !== 'draft' && log.submittedAt ? [log.submittedAt] : [])

      return {
        ...profile,
        approvedMinutes: withStatus('approved').reduce((total, log) => total + toMinutes(log.endTime!) - toMinutes(log.startTime!), 0),
        pendingCount: waiting.length,
        overdueCount: waiting.filter(item => item.isOverdue).length,
        returnedCount: withStatus('returned').length,
        lastSubmittedAt: submittedTimes.sort((a, b) => Date.parse(b) - Date.parse(a))[0],
      }
    }),
  }),

  getReviewQueue(filter, limit, studentId) {
    const students = mentoredStudents().filter(student => !studentId || student.studentId === studentId)
    // ดูได้เฉพาะนักศึกษาในความดูแล (9.2)
    if (studentId && !students.length) throw new ApiError('นักศึกษานี้ไม่อยู่ในความดูแลของคุณ', 403)

    const items = students.flatMap(student => student.worklogs
      .filter(log => filter === 'all' ? log.reviewStatus !== 'draft' : log.reviewStatus === 'submitted')
      .map(log => toReviewItem(student.studentId, student.name, log)))
    items.sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt))
    if (filter === 'all') items.reverse()

    return respond({
      student: studentId ? { studentId, name: students[0]!.name } : undefined,
      items: items.slice(0, limit),
      total: items.length,
      pendingCount: students.flatMap(student => student.worklogs).filter(log => log.reviewStatus === 'submitted').length,
      overdueDays: db.REVIEW_OVERDUE_DAYS,
      deletedReturns: deletedReturns().filter(item => !studentId || item.studentId === studentId),
    })
  },

  approveWorklogs: (targets, comment) => review(targets, 'approved', comment?.trim() || undefined),

  async returnWorklogs(targets, comment, allowTimeEdit) {
    if (!comment.trim()) throw new ApiError('กรุณาระบุความคิดเห็นเมื่อส่งกลับแก้ไข', 422)
    return review(targets, 'returned', comment.trim(), allowTimeEdit)
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
      db.refreshToday()
      return method(...args)
    }

  /** นักศึกษาดูของตนเอง พี่เลี้ยงดูของนักศึกษาในความดูแล (ขอบเขตงานข้อ 2.3) */
  async function getWorklogHistory(id: number) {
    if (currentAccount(session).profile.role !== 'supervisor') {
      requireRole(session, 'student')
      return dataApi.getWorklogHistory(id)
    }
    const found = findReviewable(id) ?? deletedReturns().find(item => item.worklog.id === id)
    if (!found) throw new ApiError('รายการที่ขออยู่นอกขอบเขตข้อมูลที่คุณมีสิทธิ์ดู', 403)
    return respond({ worklog: found.worklog, events: db.histories[id] ?? [] })
  }

  return {
    ...createMockAuth(session),

    getDashboard: guard('student', dataApi.getDashboard),
    getInternship: guard('student', dataApi.getInternship),
    getDailyWorklogs: guard('student', dataApi.getDailyWorklogs),
    listWorklogs: guard('student', dataApi.listWorklogs),
    getWorklog: guard('student', dataApi.getWorklog),
    getWorklogFormContext: guard('student', dataApi.getWorklogFormContext),
    // ต้องเข้าสู่ระบบ แต่ไม่จำกัดบทบาท
    getServerTime: async () => {
      currentAccount(session)
      db.refreshToday()
      return dataApi.getServerTime()
    },
    saveWorklog: guard('student', dataApi.saveWorklog),
    startWorklog: guard('student', dataApi.startWorklog),
    finishWorklog: guard('student', dataApi.finishWorklog),
    deleteWorklog: guard('student', dataApi.deleteWorklog),
    getWorklogHistory,
    getMyWeeklyReport: guard('student', dataApi.getMyWeeklyReport),

    getMentorStudents: guard('supervisor', dataApi.getMentorStudents),
    getMentorWeeklyReports: guard('supervisor', dataApi.getMentorWeeklyReports),
    getSupervisedStudents: guard('supervisor', dataApi.getSupervisedStudents),
    getReviewQueue: guard('supervisor', dataApi.getReviewQueue),
    approveWorklogs: guard('supervisor', dataApi.approveWorklogs),
    returnWorklogs: guard('supervisor', dataApi.returnWorklogs),
    createUnavailability: guard('supervisor', dataApi.createUnavailability),
  }
}
