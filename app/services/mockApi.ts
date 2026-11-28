import type { ReviewResult, ReviewTarget } from '~/types/review'
import type { Attachment, HistoryEvent, InternshipInfo, MentorAway, ReportData, SaveWorklogInput, UserProfile, WorkLog } from '~/types/worklog'
import { addDays, formatThaiDate, toThaiTimeParts } from '~/utils/date'
import { fileError } from '~/utils/attachments'
import { toMinutes } from '~/utils/time'
import { earliestEntryDate, editDeadline, findOverlaps, futureTimeError, isAfterWork, noMentorMessage, overlapMessage, startTimeError, timePolicy, timerFinishError, timerStartError, timeRangeError, workHoursOn } from '~/utils/worklogRules'
import { ApiError, type Api } from './api'
import { createMockAdmin, syncAdminNotifications } from './mockAdmin'
import { activeAccount, createMockAuth, requireRole } from './mockAuth'
import type { MockSession } from './mockSession'
import { addNotification, addOverdueNotifications, markRead, notificationsFor } from './mockNotifications'
import * as db from './mockData'
import { activeAbsences, appendHistory, reviewWorklogs, toReviewItem } from './mockReview'

// ข้อมูลอยู่ในหน่วยความจำ การเปลี่ยนแปลงหายเมื่อโหลดหน้าเว็บใหม่
let nextId = 1000

/** จำลองเวลารอเครือข่าย และคืนสำเนาข้อมูลเหมือนรับจากเซิร์ฟเวอร์ */
async function respond<T>(data: T): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, 150))
  return structuredClone(data)
}

/** นักศึกษาที่แอดมินกรอกข้อมูลฝึกงานและเวลางานแล้ว */
type Intern = db.StudentRecord & { internship: db.MockInternship }

function findWorklog(intern: Intern, id: number) {
  const worklog = intern.worklogs.find(item => item.id === id)
  if (worklog) return worklog
  // รายการของนักศึกษาคนอื่น (ขอบเขตงานข้อ 2.3)
  if (db.students.some(other => other.worklogs.some(item => item.id === id))) {
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

/** เวลางานที่ใช้กับวันนี้ */
function todayHours({ internship }: Intern) {
  return workHoursOn(db.TODAY, internship.hours[0]!, internship.hours)
}

function isAfterWorkNow(intern: Intern) {
  return isAfterWork(toThaiTimeParts(serverNow()).time, todayHours(intern).workEndTime)
}

/** ฉบับร่างและรายการที่ถูกส่งกลับ เลยกำหนดแก้ไขแล้วหรือยัง (นับทุกวัน) */
function isOutsideEditWindow(worklog: WorkLog) {
  return db.TODAY > editDeadline(worklog, db.settings.backdateLimitDays)
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

function reportOf({ profile, mentor, worklogs }: db.StudentRecord, from: string, to: string, includeDrafts: boolean): ReportData {
  return {
    studentId: profile.studentId!,
    name: profile.name,
    mentorName: mentor?.name ?? 'ยังไม่กำหนด',
    worklogs: worklogs.filter(log => log.date >= from && log.date <= to && (includeDrafts || log.reviewStatus !== 'draft')),
  }
}

/** รายงานหนึ่งครั้งไม่เกินหนึ่งปี */
function assertReportRange(from: string, to: string) {
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
  if (!isDate(from) || !isDate(to) || to < from || to > addDays(from, 365)) throw new ApiError('ช่วงวันที่ของรายงานไม่ถูกต้อง', 422)
}

/** นักศึกษาในความดูแลของพี่เลี้ยง (ขอบเขตงานข้อ 9.2) */
function mentoredStudents(mentor: UserProfile) {
  return db.students.flatMap(({ profile, internship, mentor: assigned, worklogs }) => {
    if (assigned !== mentor || !internship) return []
    const { company, position, startDate, endDate } = internship
    return [{ studentId: profile.studentId!, name: profile.name, email: profile.email, company, position, startDate, endDate, worklogs }]
  })
}

function internshipInfo({ internship, mentor }: Intern): InternshipInfo {
  const { company, position, semester, startDate, endDate } = internship
  const total = Date.parse(endDate) - Date.parse(startDate)
  const passed = Date.parse(db.TODAY) - Date.parse(startDate)
  const { workStartTime, workEndTime } = todayHours({ internship } as Intern)
  return {
    company,
    position,
    semester,
    startDate,
    endDate,
    workStartTime,
    workEndTime,
    mentorName: mentor?.name ?? 'ยังไม่กำหนด',
    hasMentor: Boolean(mentor),
    progress: Math.round(Math.min(1, Math.max(0, passed / total)) * 100),
  }
}

/** ไม่มีพี่เลี้ยงก็ไม่มีผู้ตรวจ จึงยังบันทึกและส่งตรวจไม่ได้ */
function assertMentor({ mentor }: Intern) {
  if (!mentor) throw new ApiError(noMentorMessage, 409, { code: 'mentor_required' })
}

/** งานของวันนี้ที่เริ่มแล้วแต่ยังไม่เสร็จ */
function findRunning(intern: Intern, excludeId?: number) {
  return intern.worklogs.find(log => log.date === db.TODAY && log.startTime && !log.endTime && log.id !== excludeId)
}

function runningError(intern: Intern, running: WorkLog) {
  const action = isAfterWorkNow(intern) ? 'กรุณากรอกเวลาสิ้นสุดของงานนั้นในหน้าแก้ไขก่อน' : 'กรุณากด "ทำงานเสร็จสิ้น" ก่อน'
  return new ApiError(`มีงานกำลังดำเนินการอยู่: “${running.title}” ${action}`, 409)
}

/** จับเวลาได้ครั้งละหนึ่งงาน ทุกทางที่บันทึกเวลา (5.7) */
function assertSingleTimer(intern: Intern, input: SaveWorklogInput) {
  const running = findRunning(intern, input.id)
  if (!running || input.date !== db.TODAY) return

  const startsNewTimer = (input.mode === 'new' && !input.id) || (input.startTime && !input.endTime)
  // งานที่จับเวลาอยู่กินช่วงตั้งแต่เวลาเริ่มจนถึงตอนนี้
  const overlapsRunning = input.endTime && toMinutes(input.endTime) > toMinutes(running.startTime!)
  if (startsNewTimer || overlapsRunning) throw runningError(intern, running)
}

function validate(intern: Intern, input: SaveWorklogInput) {
  const { internship, worklogs } = intern
  if (!input.title.trim() || !input.description.trim()) throw new ApiError('กรุณากรอกหัวข้องานและรายละเอียด', 422)
  if (input.endTime && !input.startTime) throw new ApiError('กรุณากรอกเวลาเริ่ม', 422)
  if (input.startTime) {
    const now = toThaiTimeParts(serverNow())
    // ตรวจตามเวลางานของวันที่ทำงาน
    const hours = workHoursOn(input.date, todayHours(intern), internship.hours)
    const timeError = startTimeError(input.startTime, hours)
      ?? (input.endTime ? timeRangeError(input.startTime, input.endTime, hours) : undefined)
      ?? futureTimeError(input.date, input.endTime ?? input.startTime, now)
    if (timeError) throw new ApiError(timeError, 422)
    const sameDay = worklogs.filter(log => log.date === input.date)
    const overlap = findOverlaps(sameDay, input.startTime, input.endTime, input.id)[0]
    if (overlap) throw new ApiError(overlapMessage(overlap), 409)
  }
  assertSingleTimer(intern, input)
  if (input.date < internship.startDate || input.date > internship.endDate) throw new ApiError('วันที่อยู่นอกช่วงฝึกงาน', 422)
  const existing = worklogs.find(log => log.id === input.id)
  const earliest = earliestEntryDate(existing, db.TODAY, db.settings.backdateLimitDays)
  if (input.mode === 'backdate' && (input.date < earliest || input.date > db.TODAY)) {
    throw new ApiError('วันที่อยู่นอกช่วงย้อนหลังที่อนุญาต', 422)
  }
  const invalid = input.newFiles.map(fileError).find(Boolean)
  if (invalid) throw new ApiError(invalid, 422)
  if (input.submit && !input.endTime) throw new ApiError('ต้องบันทึกเวลาสิ้นสุดก่อนส่งตรวจ', 422)
  if (input.submit && !input.keepAttachmentIds.length && !input.newFiles.length) throw new ApiError('กรุณาแนบไฟล์หลักฐานอย่างน้อย 1 ไฟล์', 422)
}

/** กันการแก้เวลาที่ล็อกไว้ และตรวจเวลาของรายการที่ระบบจับเวลา */
function assertTimeRules(intern: Intern, input: SaveWorklogInput, existing?: WorkLog) {
  const now = toThaiTimeParts(serverNow()).time
  const isFuture = (time?: string) => Boolean(time) && toMinutes(time!) > toMinutes(now)

  if (!existing) {
    if (input.mode === 'new' && (input.date !== db.TODAY || isFuture(input.startTime) || isFuture(input.endTime))) {
      throw new ApiError('รายการใหม่ต้องเป็นของวันนี้และเวลาไม่เกินเวลาปัจจุบัน', 422)
    }
    return
  }

  const policy = timePolicy(existing, db.TODAY, isAfterWorkNow(intern))
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
function timeFlags(intern: Intern, input: SaveWorklogInput, existing?: WorkLog) {
  if (!existing) {
    const timeSource: WorkLog['timeSource'] = input.mode === 'new' ? 'timer' : input.startTime ? 'manual' : undefined
    return { timeSource, timeEdited: undefined }
  }

  const changed = input.date !== existing.date || input.startTime !== existing.startTime || input.endTime !== existing.endTime
  const missedFinish = existing.date < db.TODAY || (existing.date === db.TODAY && isAfterWorkNow(intern))
  const forgotFinish = existing.timeSource === 'timer' && !existing.endTime && Boolean(input.endTime) && missedFinish
  const timeSource: WorkLog['timeSource'] = forgotFinish
    ? 'timer_manual_end'
    : existing.timeSource ?? (existing.reviewStatus === 'draft' && changed ? 'manual' : undefined)

  return { timeSource, timeEdited: existing.timeEdited || (existing.reviewStatus === 'returned' && changed) || undefined }
}

/** ฉบับร่างของนักศึกษาที่ยังอยู่ในช่วงแก้ไขได้ */
function findDraft(intern: Intern, id: number) {
  const worklog = findWorklog(intern, id)
  if (worklog.reviewStatus !== 'draft') throw new ApiError('เริ่มหรือจบงานได้เฉพาะฉบับร่าง', 409)
  if (isOutsideEditWindow(worklog)) throw new ApiError('รายการนี้เกินช่วงย้อนหลังแล้ว', 409)
  return worklog
}

/** รายการของนักศึกษาในความดูแลที่ส่งเข้ามาแล้ว (ไม่รวมฉบับร่าง) */
function findReviewable(mentor: UserProfile, id: number) {
  for (const student of mentoredStudents(mentor)) {
    const worklog = student.worklogs.find(item => item.id === id)
    if (worklog && worklog.reviewStatus !== 'draft') return { student, worklog }
  }
  return undefined
}

/** รายการที่พี่เลี้ยงส่งกลับแล้วนักศึกษาลบ (ฉบับร่างที่ไม่เคยส่งตรวจ พี่เลี้ยงไม่เห็น) */
function deletedReturns(mentor: UserProfile) {
  const ids = mentoredStudents(mentor).map(student => student.studentId)
  return db.deletedWorklogs.filter(item => item.worklog.reviewStatus === 'returned' && ids.includes(item.studentId))
}

function addHistory(worklogId: number, event: Omit<HistoryEvent, 'id' | 'changedAt'>) {
  appendHistory(worklogId, event, serverNow())
}

function review(mentor: UserProfile, targets: ReviewTarget[], decision: 'approved' | 'returned', comment?: string, allowTimeEdit?: boolean): Promise<ReviewResult> {
  return respond(reviewWorklogs({ targets, decision, comment, allowTimeEdit, reviewer: mentor, at: serverNow(), find: id => findReviewable(mentor, id), denied: 'ไม่มีสิทธิ์ตรวจรายการนี้' }))
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

/**
 * ช่วงที่พี่เลี้ยงของนักศึกษาไม่อยู่ในวันนั้น ส่งช่วงเดียว: ช่วงที่ยังไม่สิ้นสุดก่อน
 * แล้ว "ไม่อยู่" ก่อน "ไม่สะดวกตรวจ" ไม่ส่งเหตุผล
 */
function mentorAway(intern: Intern, date: string): MentorAway | undefined {
  const dayStart = Date.parse(`${date}T00:00:00+07:00`)
  const dayEnd = Date.parse(`${date}T23:59:00+07:00`)
  const now = Date.parse(serverNow())
  const isOver = (item: db.MockAbsence) => Number(Date.parse(item.endAt) <= now)
  const found = db.absences
    .filter(item => item.mentor === intern.mentor && !item.cancelledAt && Date.parse(item.startAt) <= dayEnd && Date.parse(item.endAt) > dayStart)
    .sort((a, b) => isOver(a) - isOver(b) || a.type.localeCompare(b.type) || Date.parse(a.startAt) - Date.parse(b.startAt))[0]
  if (!found) return undefined

  const start = toThaiTimeParts(found.startAt)
  const end = toThaiTimeParts(found.endAt)
  const startTime = start.date < date ? '00:00' : start.time
  const endTime = end.date > date ? '23:59' : end.time
  const hours = workHoursOn(date, todayHours(intern), intern.internship.hours)
  return { type: found.type, startTime, endTime, allDay: startTime <= hours.workStartTime && endTime >= hours.workEndTime }
}

function runningSummary(intern: Intern) {
  const running = findRunning(intern)
  return running && { id: running.id, title: running.title, startTime: running.startTime! }
}

type StudentApi = Pick<Api, 'getDashboard' | 'getInternship' | 'getDailyWorklogs' | 'listWorklogs' | 'getWorklog' | 'getWorklogFormContext' | 'saveWorklog' | 'startWorklog' | 'finishWorklog' | 'deleteWorklog' | 'getWorklogHistory' | 'getMyReport'>

/** ข้อมูลของนักศึกษาที่เข้าสู่ระบบ ทุกเมธอดเห็นเฉพาะรายการของตนเอง */
function studentApi(intern: Intern): StudentApi {
  const { profile, worklogs, internship } = intern
  const owner = { studentId: profile.studentId!, name: profile.name }

  return {
    getDashboard: () => {
      const count = (status: WorkLog['reviewStatus']) => worklogs.filter(log => log.reviewStatus === status).length

      return respond({
        today: db.TODAY,
        internship: internshipInfo(intern),
        summary: { approvedCount: count('approved'), waitingReviewCount: count('submitted'), returnedCount: count('returned') },
        // ใหม่สุดก่อน วันเดียวกันให้รายการที่ยังไม่เริ่มอยู่บนสุด แล้วเรียงตามเวลาเริ่มจากหลังไปหน้า
        recentWorklogs: withPermissions([...worklogs].sort((a, b) => b.date.localeCompare(a.date)
          || (b.startTime ?? '99:99').localeCompare(a.startTime ?? '99:99'))),
      })
    },

    getInternship: () => respond(internshipInfo(intern)),

    getDailyWorklogs: (date = db.TODAY) => respond({
      hasMentor: Boolean(intern.mentor),
      date,
      semester: internship.semester,
      worklogs: withPermissions(worklogs.filter(log => log.date === date)),
      mentorUnavailable: mentorAway(intern, date),
    }),

    listWorklogs: (from, to) => respond(withPermissions(worklogs.filter(log => log.date >= from && log.date <= to))),

    getWorklog: async id => respond(withPermissions([findWorklog(intern, id)])[0]!),

    getWorklogFormContext: (mode) => {
      const { workStartTime, workEndTime } = todayHours(intern)
      return respond({
        today: db.TODAY,
        hasMentor: Boolean(intern.mentor),
        runningWorklog: runningSummary(intern),
        backdateLimitDays: db.settings.backdateLimitDays,
        workStartTime,
        workEndTime,
        hoursHistory: internship.hours,
        internshipStart: internship.startDate,
        internshipEnd: internship.endDate,
        // ฟอร์มเปิดมาว่าง รายการใหม่เริ่มนับเวลาตั้งแต่เปิดฟอร์ม ส่วนย้อนหลังให้ผู้ใช้เลือกวันเอง
        defaults: {
          date: mode === 'new' ? db.TODAY : '',
          startTime: mode === 'new' ? toThaiTimeParts(serverNow()).time : undefined,
          title: '',
          description: '',
          attachments: [],
        },
      })
    },

    async saveWorklog(input) {
      assertMentor(intern)
      validate(intern, input)

      const existing = input.id ? findWorklog(intern, input.id) : undefined
      if (existing) {
        assertEditable(existing)
        if (isOutsideEditWindow(existing)) throw new ApiError('รายการนี้เลยกำหนดแก้ไขแล้ว แก้ไขและส่งตรวจไม่ได้', 409)
      }
      assertTimeRules(intern, input, existing)

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
        ...timeFlags(intern, input, existing),
        version: (existing?.version ?? 0) + 1,
        attachments: [...known.filter(file => input.keepAttachmentIds.includes(file.id)), ...uploaded],
      }

      if (existing) worklogs.splice(worklogs.indexOf(existing), 1, saved)
      else worklogs.push(saved)
      // เก็บประวัติการแก้ไขข้อมูลก่อนและหลัง (ขอบเขตงานข้อ 8.2)
      const change = existing ? describeChange(existing, saved) : undefined
      if (change) addHistory(saved.id, { type: 'edit', actorName: profile.name, ...change })
      if (input.submit) {
        addNotification('new_submission', owner, saved, serverNow())
        addHistory(saved.id, { type: 'status', title: 'ส่งตรวจ', actorName: profile.name, before: existing?.reviewStatus === 'returned' ? 'ส่งกลับแก้ไข' : 'ฉบับร่าง', after: 'รอตรวจ' })
      }

      return respond(saved)
    },

    async startWorklog(id) {
      assertMentor(intern)
      const worklog = findDraft(intern, id)
      if (worklog.startTime) throw new ApiError('รายการนี้เริ่มงานแล้ว', 409)

      const now = toThaiTimeParts(serverNow()).time
      if (db.TODAY < internship.startDate || db.TODAY > internship.endDate) throw new ApiError('วันนี้อยู่นอกช่วงฝึกงาน', 422)
      const outsideHours = timerStartError(now, todayHours(intern))
      if (outsideHours) throw new ApiError(outsideHours, 422)

      // จับเวลาได้ครั้งละหนึ่งงาน ไม่ให้ช่วงเวลาซ้อนกัน (5.7)
      const running = findRunning(intern, id)
      if (running) throw runningError(intern, running)
      const todayLogs = worklogs.filter(log => log.date === db.TODAY && log.id !== id)
      const overlap = findOverlaps(todayLogs, now)[0]
      if (overlap) throw new ApiError(overlapMessage(overlap), 409)

      // งานนับเป็นของวันที่ลงมือทำ
      const previousDate = worklog.date
      Object.assign(worklog, { date: db.TODAY, startTime: now, workStatus: 'in_progress', timeSource: 'timer', version: (worklog.version ?? 0) + 1 })
      addHistory(id, {
        type: 'status',
        title: 'รอดำเนินการ → กำลังดำเนินการ',
        actorName: profile.name,
        before: previousDate === db.TODAY ? 'รอดำเนินการ' : `รอดำเนินการ · วันที่: ${formatThaiDate(previousDate)}`,
        after: previousDate === db.TODAY ? 'กำลังดำเนินการ' : `กำลังดำเนินการ · วันที่: ${formatThaiDate(db.TODAY)}`,
      })
      return respond(worklog)
    },

    async finishWorklog(id) {
      assertMentor(intern)
      const worklog = findDraft(intern, id)
      if (!worklog.startTime || worklog.endTime) throw new ApiError('รายการนี้ไม่ได้อยู่ระหว่างดำเนินการ', 409)
      // งานต้องเสร็จภายในวันเดียวกัน
      if (worklog.date !== db.TODAY) throw new ApiError('บันทึกเวลาสิ้นสุดข้ามวันไม่ได้ กรุณากรอกเวลาสิ้นสุดในหน้าแก้ไขรายการ', 409)

      const now = toThaiTimeParts(serverNow()).time
      const hours = todayHours(intern)
      const timeError = timerFinishError(now, hours) ?? timeRangeError(worklog.startTime, now, hours)
      if (timeError) throw new ApiError(timeError, 422)
      const overlap = findOverlaps(worklogs.filter(log => log.date === db.TODAY), worklog.startTime, now, id)[0]
      if (overlap) throw new ApiError(overlapMessage(overlap), 409)

      Object.assign(worklog, { endTime: now, workStatus: 'done', version: (worklog.version ?? 0) + 1 })
      addHistory(id, { type: 'status', title: 'กำลังดำเนินการ → เสร็จสิ้น', actorName: profile.name, before: 'กำลังดำเนินการ', after: 'เสร็จสิ้น' })
      return respond(worklog)
    },

    async deleteWorklog(id, reason) {
      const worklog = findWorklog(intern, id)
      assertEditable(worklog)
      if (!reason.trim()) throw new ApiError('กรุณาระบุเหตุผล', 422)
      // ย้ายออกจากรายการใช้งาน แต่เก็บข้อมูลและประวัติไว้ (ขอบเขตงานข้อ 8.2)
      worklogs.splice(worklogs.indexOf(worklog), 1)
      const deletion = { deletedAt: serverNow(), deletedBy: profile.name, reason: reason.trim() }
      db.deletedWorklogs.unshift({ studentId: owner.studentId, studentName: owner.name, worklog: { ...worklog, deletion } })
      addHistory(id, {
        type: 'delete',
        title: `ลบรายการ: ${deletion.reason}`,
        actorName: profile.name,
        before: worklog.reviewStatus === 'returned' ? 'ส่งกลับแก้ไข' : 'ฉบับร่าง',
        after: 'ถูกลบ',
      })
      await respond(null)
    },

    getWorklogHistory: async (id) => {
      const removed = db.deletedWorklogs.find(item => item.worklog.id === id && item.studentId === owner.studentId)
      const worklog = removed?.worklog ?? findWorklog(intern, id)
      return respond({ worklog, events: db.histories[id] ?? [] })
    },

    getMyReport: async (from, to) => {
      assertReportRange(from, to)
      return respond(reportOf(intern, from, to, true))
    },
  }
}

type MentorApi = Pick<Api, 'getMentorStudents' | 'getMentorReports' | 'getSupervisedStudents' | 'getReviewQueue' | 'approveWorklogs' | 'returnWorklogs' | 'createUnavailability' | 'getWorklogHistory'>

/** ข้อมูลของพี่เลี้ยงที่เข้าสู่ระบบ เห็นเฉพาะนักศึกษาในความดูแล */
function mentorApi(mentor: UserProfile): MentorApi {
  return {
    getMentorStudents: () => respond(mentoredStudents(mentor).map(({ studentId, name }) => ({ studentId, name }))),

    getMentorReports: async (from, to, studentId) => {
      assertReportRange(from, to)
      return respond(db.students
        .filter(item => item.mentor === mentor && item.internship && (!studentId || item.profile.studentId === studentId))
        // ฉบับร่างยังไม่ถูกส่งตรวจ พี่เลี้ยงจึงไม่เห็น
        .map(item => reportOf(item, from, to, false)))
    },

    getSupervisedStudents: () => respond({
      overdueDays: db.settings.reviewOverdueDays,
      students: mentoredStudents(mentor).map(({ worklogs, ...profile }) => {
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
      const students = mentoredStudents(mentor).filter(student => !studentId || student.studentId === studentId)
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
        overdueDays: db.settings.reviewOverdueDays,
        deletedReturns: deletedReturns(mentor).filter(item => !studentId || item.studentId === studentId),
      })
    },

    approveWorklogs: (targets, comment) => review(mentor, targets, 'approved', comment?.trim() || undefined),

    async returnWorklogs(targets, comment, allowTimeEdit) {
      if (!comment.trim()) throw new ApiError('กรุณาระบุความคิดเห็นเมื่อส่งกลับแก้ไข', 422)
      return review(mentor, targets, 'returned', comment.trim(), allowTimeEdit)
    },

    async createUnavailability(input) {
      if (!input.reason.trim()) throw new ApiError('กรุณาระบุเหตุผล', 422)
      if (input.date < db.TODAY) throw new ApiError('ไม่สามารถแจ้งวันที่ผ่านมาแล้ว', 422)
      if (toMinutes(input.endTime) <= toMinutes(input.startTime)) throw new ApiError('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม', 422)
      const startAt = `${input.date}T${input.startTime}:00+07:00`
      const endAt = `${input.date}T${input.endTime}:00+07:00`
      const overlaps = db.absences.some(item => item.mentor === mentor && item.type === 'unavailable'
        && Date.parse(startAt) < Date.parse(item.endAt) && Date.parse(item.startAt) < Date.parse(endAt))
      if (overlaps) throw new ApiError('ช่วงเวลานี้ซ้อนกับที่แจ้งไว้แล้ว', 409)
      db.absences.push({ id: nextId++, type: 'unavailable', mentor, startAt, endAt, reason: input.reason.trim(), createdBy: mentor })
      await respond(null)
    },

    getWorklogHistory: async (id) => {
      const found = findReviewable(mentor, id) ?? deletedReturns(mentor).find(item => item.worklog.id === id)
      if (!found) throw new ApiError('รายการที่ขออยู่นอกขอบเขตข้อมูลที่คุณมีสิทธิ์ดู', 403)
      return respond({ worklog: found.worklog, events: db.histories[id] ?? [] })
    },
  }
}

/** ตรวจ session และบทบาทก่อนเรียกข้อมูล เหมือนที่ backend ต้องทำ (ขอบเขตงานข้อ 2.2, 2.3) */
export function createMockApi(session: MockSession): Api {
  function currentIntern(): Intern {
    requireRole(session, 'student')
    db.refreshToday()
    const record = db.recordOf(activeAccount(session).profile)
    if (!record?.internship?.hours.length) throw new ApiError('ข้อมูลการฝึกงานยังไม่ครบ กรุณาติดต่อแอดมิน', 404)
    return record as Intern
  }

  function currentMentor() {
    requireRole(session, 'supervisor')
    db.refreshToday()
    return activeAccount(session).profile
  }

  const student = <Key extends keyof StudentApi>(key: Key) =>
    (async (...args: unknown[]) => (studentApi(currentIntern())[key] as (...values: unknown[]) => unknown)(...args)) as StudentApi[Key]

  const mentor = <Key extends keyof MentorApi>(key: Key) =>
    (async (...args: unknown[]) => (mentorApi(currentMentor())[key] as (...values: unknown[]) => unknown)(...args)) as MentorApi[Key]

  /** นักศึกษาดูของตนเอง พี่เลี้ยงดูของนักศึกษาในความดูแล (ขอบเขตงานข้อ 2.3) แอดมินดูตามสิทธิ์อนุมัติแทน */
  const getWorklogHistory = (id: number) => {
    const { role } = activeAccount(session).profile
    if (role === 'admin') return adminWorklogHistory(id)
    return role === 'supervisor' ? mentor('getWorklogHistory')(id) : student('getWorklogHistory')(id)
  }

  /** แอดมินดูได้เฉพาะรายการที่อนุมัติแทนได้ตอนนี้ หรือที่เคยอนุมัติแทน */
  async function adminWorklogHistory(id: number) {
    requireRole(session, 'admin')
    db.refreshToday()
    const owner = db.students.find(item => item.worklogs.some(log => log.id === id))
    const worklog = owner?.worklogs.find(log => log.id === id)
    const allowed = owner && (db.proxyApprovals.some(item => item.worklogId === id)
      || (worklog?.reviewStatus === 'submitted' && activeAbsences(serverNow()).some(item => item.mentor === owner.mentor)))
    if (!allowed) throw new ApiError('รายการที่ขออยู่นอกขอบเขตข้อมูลที่คุณมีสิทธิ์ดู', 403)
    return respond({ worklog: worklog!, events: db.histories[id] ?? [] })
  }

  /** นักศึกษาที่ผู้ใช้เกี่ยวข้อง ใช้เลือกการแจ้งเตือน: ตนเอง หรือผู้ที่ตนดูแล */
  function relatedStudents(profile: UserProfile) {
    if (profile.role === 'student') return [profile.studentId!]
    return mentoredStudents(profile).map(item => item.studentId)
  }

  /** การแจ้งเตือนแยกตามผู้ที่เข้าสู่ระบบ */
  async function getNotifications() {
    const { profile } = activeAccount(session)
    db.refreshToday()
    if (profile.role === 'admin') syncAdminNotifications(serverNow())
    if (profile.role === 'supervisor') {
      addOverdueNotifications(mentoredStudents(profile).flatMap(item => item.worklogs
        .filter(log => log.reviewStatus === 'submitted')
        .map(log => toReviewItem(item.studentId, item.name, log))))
    }

    return respond(notificationsFor(profile.role, relatedStudents(profile)).map(({ recipient, ...notification }) => {
      const worklog = db.recordOf(profile)?.worklogs.find(log => log.id === notification.worklogId)
      const canEdit = notification.type === 'returned' && worklog?.reviewStatus === 'returned' && !isOutsideEditWindow(worklog)
      return { ...notification, canEdit }
    }))
  }

  async function markNotificationsRead(ids?: number[]) {
    const { profile } = activeAccount(session)
    markRead(profile.role, relatedStudents(profile), ids)
    await respond(null)
  }

  return {
    ...createMockAuth(session),
    ...createMockAdmin(session, serverNow),
    getNotifications,
    markNotificationsRead,

    getDashboard: student('getDashboard'),
    getInternship: student('getInternship'),
    getDailyWorklogs: student('getDailyWorklogs'),
    listWorklogs: student('listWorklogs'),
    getWorklog: student('getWorklog'),
    getWorklogFormContext: student('getWorklogFormContext'),
    // ต้องเข้าสู่ระบบ แต่ไม่จำกัดบทบาท
    getServerTime: async () => {
      activeAccount(session)
      db.refreshToday()
      return respond(serverNow())
    },
    saveWorklog: student('saveWorklog'),
    startWorklog: student('startWorklog'),
    finishWorklog: student('finishWorklog'),
    deleteWorklog: student('deleteWorklog'),
    getWorklogHistory,
    getMyReport: student('getMyReport'),

    getMentorStudents: mentor('getMentorStudents'),
    getMentorReports: mentor('getMentorReports'),
    getSupervisedStudents: mentor('getSupervisedStudents'),
    getReviewQueue: mentor('getReviewQueue'),
    approveWorklogs: mentor('approveWorklogs'),
    returnWorklogs: mentor('returnWorklogs'),
    createUnavailability: mentor('createUnavailability'),
  }
}
