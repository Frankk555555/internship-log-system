// ข้อมูลจำลองของแอดมิน โหลดพร้อม mockApi เมื่อใช้ข้อมูลจำลองเท่านั้น
import type { AdminApi, AdminTask, AdminUser, ImportRow, InternshipDetail, InternshipRow, MentorAbsence, UserImport, UserInput } from '~/types/admin'
import { importFileError, internshipErrors, maxImportRows, settingDayError, userInputErrors } from '~/utils/adminRules'
import { roleLabels } from '~/utils/auth'
import { formatThaiDate, toThaiTimeParts } from '~/utils/date'
import { workHoursOn } from '~/utils/worklogRules'
import { ApiError } from './api'
import { mockAccounts, type MockAccount } from './mockAccounts'
import { clearFailures, currentAccount, lockedUntilFor, requireRole, sendResetLink } from './mockAuth'
import * as db from './mockData'
import { readUserSheet, userSheetTemplate, type SheetRecord } from './mockImport'
import { activeAbsences, reviewWorklogs, toReviewItem } from './mockReview'
import { reassignStudent, syncAdminAlerts, type AdminAlert } from './mockNotifications'
import type { MockSession } from './mockSession'

const userPageSize = 8
const internshipPageSize = 8
const wait = () => new Promise(resolve => setTimeout(resolve, 150))

function toAdminUser({ id, suspended, lastLoginAt, profile }: MockAccount): AdminUser {
  const { name, firstName, lastName, email, role, studentId } = profile
  const until = suspended ? undefined : lockedUntilFor(email)
  return {
    id,
    name,
    firstName,
    lastName,
    email,
    role,
    studentId: role === 'student' ? studentId : undefined,
    status: suspended ? 'suspended' : until ? 'locked' : 'active',
    lockedUntil: until ? new Date(until).toISOString() : undefined,
    lastLoginAt,
  }
}

function findUser(id: number) {
  const account = mockAccounts.find(item => item.id === id)
  if (!account) throw new ApiError('ไม่พบผู้ใช้นี้', 404)
  return account
}

/** ตรวจและจัดรูปข้อมูลผู้ใช้ อีเมลและรหัสนักศึกษาซ้ำกันไม่ได้ (ขอบเขตงานข้อ 4.3) */
function checkUser(input: UserInput, current?: MockAccount) {
  const problem = Object.values(userInputErrors(input)).find(Boolean)
  if (problem) throw new ApiError(problem, 422)
  const next = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    // อีเมลเก็บเป็นตัวพิมพ์เล็ก เทียบกันโดยไม่สนตัวพิมพ์
    email: input.email.trim().toLowerCase(),
    studentId: input.role === 'student' ? input.studentId!.trim() : undefined,
  }
  const others = mockAccounts.filter(account => account !== current)
  if (others.some(account => account.profile.email === next.email)) {
    throw new ApiError('อีเมลนี้มีบัญชีอยู่แล้ว', 409, { code: 'email_taken' })
  }
  if (next.studentId && others.some(account => account.profile.studentId === next.studentId)) {
    throw new ApiError('รหัสนักศึกษานี้มีบัญชีอยู่แล้ว', 409, { code: 'student_id_taken' })
  }
  return next
}

function toRow({ profile, internship, mentor }: db.StudentRecord): InternshipRow {
  const hours = internship?.hours.length ? workHoursOn(db.TODAY, internship.hours[0]!, internship.hours) : undefined
  return {
    studentId: profile.studentId!,
    name: profile.name,
    company: internship?.company,
    position: internship?.position,
    startDate: internship?.startDate,
    endDate: internship?.endDate,
    workStartTime: hours?.workStartTime,
    workEndTime: hours?.workEndTime,
    mentorName: mentor?.name,
  }
}

function findStudent(studentId: string) {
  const record = db.students.find(item => item.profile.studentId === studentId)
  if (!record) throw new ApiError('ไม่พบนักศึกษาคนนี้', 404)
  return record
}

function toDetail(record: db.StudentRecord): InternshipDetail {
  const supervisors = mockAccounts.filter(account => account.profile.role === 'supervisor'
    // พี่เลี้ยงคนปัจจุบันถูกระงับก็ยังต้องแสดง
    && (!account.suspended || account.profile === record.mentor))
  return {
    ...toRow(record),
    mentorId: mockAccounts.find(account => account.profile === record.mentor)?.id,
    mentors: supervisors.map(({ id, suspended, profile }) => ({ id, name: suspended ? `${profile.name} (ระงับการใช้งาน)` : profile.name })),
    mentorHistory: record.mentorHistory.map(({ mentor, from, to }) => ({ mentorName: mentor.name, from, to })),
    pendingCount: record.worklogs.filter(log => log.reviewStatus === 'submitted').length,
  }
}

/** เพิ่มช่วงเวลางานเมื่อค่าที่ใช้กับวันนี้เปลี่ยน รายการก่อนวันนี้ยังตรวจตามเวลาเดิม */
function nextHours(history: db.MockInternship['hours'], startDate: string, workStartTime: string, workEndTime: string) {
  const same = (period?: { workStartTime: string, workEndTime: string }) => period?.workStartTime === workStartTime && period.workEndTime === workEndTime
  if (!history.length) return [{ effectiveFrom: startDate, workStartTime, workEndTime }]
  if (same(workHoursOn(db.TODAY, history[0]!, history))) return history
  const earlier = history.filter(period => period.effectiveFrom < db.TODAY)
  return same(earlier.at(-1)) ? earlier : [...earlier, { effectiveFrom: db.TODAY, workStartTime, workEndTime }]
}

function toAbsence(item: db.MockAbsence, now: number): MentorAbsence {
  return {
    id: item.id,
    type: item.type,
    mentorName: item.mentor.name,
    startAt: item.startAt,
    endAt: item.endAt,
    reason: item.reason,
    status: item.cancelledAt ? 'cancelled' : Date.parse(item.endAt) <= now ? 'ended' : Date.parse(item.startAt) <= now ? 'now' : 'upcoming',
    cancelled: item.cancelledAt ? { at: item.cancelledAt, by: item.cancelledBy!.name } : undefined,
    proxyApprovalCount: db.proxyApprovals.filter(approval => approval.absenceId === item.id).length,
  }
}

const accountIdOf = (profile: db.MockAbsence['mentor']) => mockAccounts.find(account => account.profile === profile)!.id

/** นักศึกษาที่พี่เลี้ยงคนนี้ดูแลอยู่ตอนนี้ */
const supervisedBy = (mentor: db.MockAbsence['mentor']) => db.students.filter(item => item.mentor === mentor && item.internship)

/** งานรอตรวจของนักศึกษาในความดูแล ส่งก่อนอยู่บน */
const waitingFor = (mentor: db.MockAbsence['mentor']) => supervisedBy(mentor)
  .flatMap(({ profile, worklogs }) => worklogs
    .filter(log => log.reviewStatus === 'submitted')
    .map(log => toReviewItem(profile.studentId!, profile.name, log)))
  .sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt))

function lastImportSummary() {
  const result = lastImportId ? imports.get(lastImportId)?.result : undefined
  if (!result) return undefined
  const { rows: _rows, fileSize: _fileSize, ...summary } = result
  return summary
}

/** ช่วงที่กำลังมีผลหรือรอถึงเวลา */
const isOpenAbsence = ({ status }: MentorAbsence) => status === 'now' || status === 'upcoming'

/** ช่วงที่ยังเปิดอยู่ก่อน เรียงตามเวลาเริ่ม แล้วช่วงที่สิ้นสุดหรือยกเลิกแล้ว ใหม่สุดก่อน */
function listAbsences(now: number) {
  const all = db.absences.map(item => toAbsence(item, now))
  const closedAt = (item: MentorAbsence) => Date.parse(item.cancelled?.at ?? item.endAt)
  const open = all.filter(isOpenAbsence).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  const closed = all.filter(item => !isOpenAbsence(item)).sort((a, b) => closedAt(b) - closedAt(a))
  return [...open, ...closed]
}

const activeAccountsOf = (role: AdminUser['role']) => mockAccounts.filter(account => account.profile.role === role && !account.suspended)

/** พี่เลี้ยงที่ไม่อยู่ตอนนี้และมีงานรอตรวจ */
const absentWithPending = (now: string) => activeAbsences(now)
  .map(absence => ({ absence, waiting: waitingFor(absence.mentor) }))
  .filter(item => item.waiting.length)

/** นักศึกษาที่ใช้งานอยู่ บัญชีที่ถูกระงับไม่ต้องจัดการ */
const activeStudents = () => db.students.filter(record => activeAccountsOf('student').some(account => account.profile === record.profile))

const studentsWithoutMentor = () => activeStudents().filter(record => !record.mentor)

/** คนเดียวบอกชื่อ หลายคนบอกจำนวนและชื่อไม่เกินสองคน */
function studentNames(names: string[]) {
  if (names.length === 1) return names[0]!
  const listed = names.length === 2 ? names.join(' และ ') : `${names.slice(0, 2).join(', ')} และอีก ${names.length - 2} คน`
  return `นักศึกษา ${names.length} คน (${listed})`
}

/** ปรับการแจ้งเตือนของแอดมินตามสถานการณ์ปัจจุบัน เรียกตอนเปิดรายการแจ้งเตือน */
export function syncAdminNotifications(now: string) {
  const absent = absentWithPending(now).map(({ absence, waiting }): AdminAlert => {
    const { date, time } = toThaiTimeParts(absence.endAt)
    return {
      key: `absence-${absence.id}`,
      type: 'absent_mentor_pending',
      message: `${absence.mentor.name} ไม่อยู่ถึง ${formatThaiDate(date)} ${time} น. นักศึกษารอตรวจ ${waiting.length} รายการ`,
      mentorId: accountIdOf(absence.mentor),
    }
  })
  // นักศึกษาทุกคนรวมเป็นเรื่องเดียว นำเข้าครั้งละหลายคนจะได้ไม่แจ้งทีละคน
  const without = studentsWithoutMentor().map(({ profile }) => profile)
  const noMentor: AdminAlert[] = without.length
    ? [{
        key: 'no-mentor',
        type: 'student_without_mentor',
        message: `${studentNames(without.map(profile => profile.name))} ยังบันทึกและส่งตรวจไม่ได้`,
        members: without.map(accountIdOf),
      }]
    : []
  syncAdminAlerts([...absent, ...noMentor], now)
}

function adminTasks(now: string) {
  const tasks: AdminTask[] = absentWithPending(now).map(({ absence, waiting }) => ({
    kind: 'absent_mentor',
    mentorId: accountIdOf(absence.mentor),
    mentorName: absence.mentor.name,
    endAt: absence.endAt,
    pendingCount: waiting.length,
    overdueCount: waiting.filter(item => item.isOverdue).length,
  }))
  const named = (records: db.StudentRecord[]) => records.map(({ profile, internship }) => ({ name: profile.name, company: internship?.company }))
  const noMentor = studentsWithoutMentor()
  if (noMentor.length) tasks.push({ kind: 'no_mentor', students: named(noMentor) })
  const noHours = activeStudents().filter(record => !record.internship?.hours.length)
  if (noHours.length) tasks.push({ kind: 'no_hours', students: named(noHours) })
  const locked = mockAccounts.map(toAdminUser).flatMap(user => user.status === 'locked' ? [{ email: user.email, lockedUntil: user.lockedUntil! }] : [])
  if (locked.length) tasks.push({ kind: 'locked', accounts: locked })
  return tasks
}

/** สร้างบัญชีจากข้อมูลที่ตรวจแล้ว */
function addAccount(next: ReturnType<typeof checkUser>, role: AdminUser['role']) {
  const isStudent = role === 'student'
  const account: MockAccount = {
    id: Math.max(...mockAccounts.map(item => item.id)) + 1,
    // นักศึกษาเริ่มด้วยรหัสนักศึกษา บทบาทอื่นยังเข้าไม่ได้จนกว่าจะตั้งรหัสจากลิงก์
    password: next.studentId ?? crypto.randomUUID(),
    profile: {
      ...next,
      name: `${next.firstName} ${next.lastName}`,
      initials: '',
      role,
      mustChangePassword: isStudent,
      defaultReportDate: db.TODAY,
    },
  }
  db.applyUserChange(account.profile, next)
  mockAccounts.unshift(account)
  if (isStudent) db.students.push({ profile: account.profile, mentorHistory: [], worklogs: [] })
  if (!isStudent) sendResetLink(account)
  return account
}

/** ไฟล์ที่ตรวจแล้ว เก็บไว้จนกว่าจะโหลดหน้าเว็บใหม่ */
const imports = new Map<string, { fileName: string, fileSize: number, records: SheetRecord[], result?: UserImport }>()
let lastImportId: string | undefined

const roleOf = (text: string) => (Object.keys(roleLabels) as AdminUser['role'][]).find(role => roleLabels[role] === text)

/** ตรวจทุกแถวเทียบกับบัญชีที่มีอยู่ และข้อมูลซ้ำกันภายในไฟล์ */
function checkRows(records: SheetRecord[]) {
  const emailOf = (record: SheetRecord) => record.email.toLowerCase()
  const studentIdOf = (record: SheetRecord) => roleOf(record.role) === 'student' ? record.studentId : ''

  return records.map((record) => {
    const role = roleOf(record.role)
    const found = userInputErrors({ ...record, role: role ?? 'admin' })
    const email = emailOf(record)
    const studentId = studentIdOf(record)
    const sameRows = (value: string, pick: (other: SheetRecord) => string) => records
      .filter(other => other !== record && value && pick(other) === value)
      .map(other => other.row)
    const sameEmail = sameRows(email, emailOf)
    const sameStudentId = sameRows(studentId, studentIdOf)

    const errors = [
      record.firstName ? found.firstName : 'ไม่มีชื่อ',
      record.lastName ? found.lastName : 'ไม่มีนามสกุล',
      record.email ? found.email : 'ไม่มีอีเมล',
      role ? undefined : record.role ? 'บทบาทไม่ถูกต้อง' : 'ไม่มีบทบาท',
      role === 'student' ? record.studentId ? found.studentId : 'ไม่มีรหัสนักศึกษา' : undefined,
      email && mockAccounts.some(account => account.profile.email === email) ? 'อีเมลซ้ำกับบัญชีเดิม' : undefined,
      studentId && mockAccounts.some(account => account.profile.studentId === studentId) ? 'รหัสนักศึกษาซ้ำกับบัญชีเดิม' : undefined,
      sameEmail.length ? `อีเมลซ้ำกับแถว ${sameEmail.join(', ')}` : undefined,
      sameStudentId.length ? `รหัสนักศึกษาซ้ำกับแถว ${sameStudentId.join(', ')}` : undefined,
    ].filter((error): error is string => Boolean(error))

    return { record, role, errors }
  })
}

function toImport(importId: string, fileName: string, fileSize: number, checked: ReturnType<typeof checkRows>): UserImport {
  const rows: ImportRow[] = checked.map(({ record, role, errors }) => ({
    row: record.row,
    name: `${record.firstName} ${record.lastName}`.trim(),
    email: record.email,
    role,
    roleText: record.role,
    errors,
  })).sort((a, b) => Number(!a.errors.length) - Number(!b.errors.length) || a.row - b.row)
  const errorCount = rows.filter(row => row.errors.length).length
  return { importId, fileName, fileSize, rows, readyCount: rows.length - errorCount, errorCount }
}

/** ช่วงไม่อยู่ของพี่เลี้ยงคนเดียวกันต้องไม่ซ้อนกัน */
function assertNoAbsenceOverlap(mentor: db.MockAbsence['mentor'], startAt: string, endAt: string, ignoreId?: number) {
  const overlaps = db.absences.some(item => item.id !== ignoreId && item.mentor === mentor && item.type === 'absent' && !item.cancelledAt
    && Date.parse(startAt) < Date.parse(item.endAt) && Date.parse(item.startAt) < Date.parse(endAt))
  if (overlaps) throw new ApiError('ช่วงเวลานี้ซ้อนกับช่วงไม่อยู่ที่บันทึกไว้ของพี่เลี้ยงคนนี้', 409)
}

const isDateTime = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value))

/** now: เวลาเซิร์ฟเวอร์จำลอง ใช้บันทึกว่าแก้เมื่อไร */
export function createMockAdmin(session: MockSession, now: () => string): AdminApi {
  let nextAbsenceId = 500

  /** ทุกคำขอต้องเป็นแอดมิน คืนข้อมูลผู้ที่ทำรายการ */
  async function authorise() {
    await wait()
    requireRole(session, 'admin')
    db.refreshToday()
    return currentAccount(session).profile
  }

  return {
    async getOverview() {
      await authorise()
      const current = now()
      const waiting = db.students.flatMap(({ profile, worklogs }) => worklogs
        .filter(log => log.reviewStatus === 'submitted')
        .map(log => toReviewItem(profile.studentId!, profile.name, log)))
      return structuredClone({
        semester: db.currentSemester,
        studentCount: activeAccountsOf('student').length,
        supervisorCount: activeAccountsOf('supervisor').length,
        pendingCount: waiting.length,
        overdueCount: waiting.filter(item => item.isOverdue).length,
        overdueDays: db.settings.reviewOverdueDays,
        maxFailedLogins: db.settings.maxFailedLogins,
        tasks: adminTasks(current),
        absences: listAbsences(Date.parse(current)).filter(item => item.type === 'absent' && isOpenAbsence(item)),
        lastImport: lastImportSummary(),
      })
    },

    async previewUserImport(file) {
      await authorise()
      const problem = importFileError(file)
      if (problem) throw new ApiError(problem, 422)
      const records = await readUserSheet(file, maxImportRows)
      const importId = crypto.randomUUID()
      imports.set(importId, { fileName: file.name, fileSize: file.size, records })
      return toImport(importId, file.name, file.size, checkRows(records))
    },

    async commitUserImport(importId) {
      const actor = await authorise()
      const entry = imports.get(importId)
      if (!entry) throw new ApiError('ไม่พบไฟล์ที่ตรวจไว้ กรุณาเลือกไฟล์ใหม่', 404)
      if (entry.result) throw new ApiError('ไฟล์นี้นำเข้าไปแล้ว', 409)
      // ตรวจใหม่ตอนยืนยัน บัญชีอาจเปลี่ยนไปหลังดูผลตรวจ
      const checked = checkRows(entry.records)
      const ready = checked.filter(item => !item.errors.length)
      if (!ready.length) throw new ApiError('ไม่มีแถวที่นำเข้าได้', 422)
      // บัญชีใหม่ขึ้นก่อนในรายชื่อ เพิ่มจากแถวท้ายให้ลำดับตรงกับไฟล์
      for (const { record, role } of [...ready].reverse()) {
        addAccount(checkUser({ ...record, role: role! }), role!)
      }
      entry.result = { ...toImport(importId, entry.fileName, entry.fileSize, checked), imported: { at: now(), by: actor.name } }
      lastImportId = importId
      return structuredClone(entry.result)
    },

    async getUserImport(importId) {
      await authorise()
      const result = imports.get(importId)?.result
      if (!result) throw new ApiError('ไม่พบผลการนำเข้านี้', 404)
      return structuredClone(result)
    },

    async getUserImportTemplate() {
      await authorise()
      return userSheetTemplate()
    },

    async getSystemSettings() {
      await authorise()
      return structuredClone(db.settings)
    },

    async saveSystemSettings({ backdateLimitDays, reviewOverdueDays }) {
      const actor = await authorise()
      const problem = settingDayError(String(backdateLimitDays)) ?? settingDayError(String(reviewOverdueDays))
      if (problem) throw new ApiError(problem, 422)
      Object.assign(db.settings, { backdateLimitDays, reviewOverdueDays, updatedAt: now(), updatedBy: actor.name })
      return structuredClone(db.settings)
    },

    async getUsers({ role, status, q, page }) {
      await authorise()
      const keyword = q.trim().toLowerCase()
      const matched = mockAccounts.map(toAdminUser).filter(user => (status === 'all' || user.status === status)
        && (!keyword || [user.name, user.email, user.studentId ?? ''].some(value => value.toLowerCase().includes(keyword))))
      const ofRole = (value: AdminUser['role']) => matched.filter(user => user.role === value)
      const items = role === 'all' ? matched : ofRole(role)
      const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(items.length / userPageSize)))
      return {
        items: items.slice((current - 1) * userPageSize, current * userPageSize),
        total: items.length,
        pageSize: userPageSize,
        counts: { all: matched.length, student: ofRole('student').length, supervisor: ofRole('supervisor').length, admin: ofRole('admin').length },
      }
    },

    async createUser(input) {
      await authorise()
      const next = checkUser(input)
      return toAdminUser(addAccount(next, input.role))
    },

    async updateUser(id, input) {
      const actor = await authorise()
      const account = findUser(id)
      const { profile } = account
      if (input.role !== profile.role) throw new ApiError('เปลี่ยนบทบาทของบัญชีไม่ได้', 422)
      const next = checkUser(input, account)
      const previous = { email: profile.email, studentId: profile.studentId }
      // บัญชีที่ยังใช้รหัสเริ่มต้น แก้รหัสนักศึกษาแล้วรหัสผ่านเริ่มต้นต้องเปลี่ยนตาม
      if (profile.mustChangePassword && account.password === previous.studentId) account.password = next.studentId!

      db.applyUserChange(profile, next)
      if (previous.studentId && next.studentId) reassignStudent(previous.studentId, next.studentId)
      if (previous.email !== next.email) {
        clearFailures(previous.email)
        // session จำลองอ้างอิงอีเมล แก้อีเมลตัวเองต้องไม่หลุดจากระบบ
        if (actor === profile) session.write(next.email)
      }
      return toAdminUser(account)
    },

    async setUserSuspended(id, suspended) {
      const actor = await authorise()
      const account = findUser(id)
      if (suspended && account.profile === actor) throw new ApiError('ระงับบัญชีของตัวเองไม่ได้', 422)
      account.suspended = suspended
      return toAdminUser(account)
    },

    async unlockUser(id) {
      await authorise()
      const account = findUser(id)
      clearFailures(account.profile.email)
      return toAdminUser(account)
    },

    async getMentorAbsences(type) {
      await authorise()
      const items = listAbsences(Date.parse(now()))
      return structuredClone({
        items: type === 'all' ? items : items.filter(item => item.type === type),
        counts: { all: items.length, absent: items.filter(item => item.type === 'absent').length, unavailable: items.filter(item => item.type === 'unavailable').length },
        mentors: mockAccounts.filter(account => account.profile.role === 'supervisor' && !account.suspended).map(({ id, profile }) => ({ id, name: profile.name })),
        today: db.TODAY,
      })
    },

    async createMentorAbsence({ mentorId, startAt, endAt, reason }) {
      const actor = await authorise()
      const account = mockAccounts.find(item => item.id === mentorId && item.profile.role === 'supervisor' && !item.suspended)
      if (!account) throw new ApiError('เลือกพี่เลี้ยงที่ใช้งานอยู่', 422)
      if (!reason.trim()) throw new ApiError('กรุณาระบุเหตุผล', 422)
      if (!isDateTime(startAt) || !isDateTime(endAt)) throw new ApiError('รูปแบบวันที่หรือเวลาไม่ถูกต้อง', 422)
      if (Date.parse(endAt) <= Date.parse(startAt)) throw new ApiError('เวลาสิ้นสุดต้องหลังเวลาเริ่ม', 422)
      if (Date.parse(endAt) <= Date.parse(now())) throw new ApiError('ช่วงนี้สิ้นสุดไปแล้ว บันทึกได้เฉพาะช่วงที่ยังไม่สิ้นสุด', 422)
      assertNoAbsenceOverlap(account.profile, startAt, endAt)
      // เลขของช่วงใหม่ต้องไม่ชนกับของเดิม แม้สร้าง API จำลองใหม่
      const id = Math.max(nextAbsenceId++, ...db.absences.map(item => item.id + 1))
      const item: db.MockAbsence = { id, type: 'absent', mentor: account.profile, startAt, endAt, reason: reason.trim(), createdBy: actor }
      db.absences.push(item)
      return toAbsence(item, Date.parse(now()))
    },

    async updateAbsenceEnd(id, endAt) {
      await authorise()
      const item = db.absences.find(entry => entry.id === id)
      if (!item) throw new ApiError('ไม่พบช่วงเวลานี้', 404)
      if (item.type !== 'absent') throw new ApiError('ช่วงที่พี่เลี้ยงแจ้งเองปรับจากหน้านี้ไม่ได้', 422)
      if (item.cancelledAt) throw new ApiError('ช่วงนี้ถูกยกเลิกแล้ว', 409)
      if (Date.parse(item.endAt) <= Date.parse(now())) throw new ApiError('ช่วงที่สิ้นสุดแล้วปรับไม่ได้', 409)
      if (!isDateTime(endAt)) throw new ApiError('รูปแบบวันที่หรือเวลาไม่ถูกต้อง', 422)
      if (Date.parse(endAt) <= Date.parse(item.startAt)) throw new ApiError('เวลาสิ้นสุดต้องหลังเวลาเริ่ม', 422)
      // ช่วงต้องยังครอบคลุมเวลาที่อนุมัติแทนไปแล้ว ไม่เช่นนั้นการอนุมัตินั้นจะอยู่นอกช่วง
      const lastApproval = db.proxyApprovals.filter(entry => entry.absenceId === id).map(entry => entry.approvedAt).sort().at(-1)
      if (lastApproval && Date.parse(endAt) <= Date.parse(lastApproval)) {
        const { date, time } = toThaiTimeParts(lastApproval)
        throw new ApiError(`มีการอนุมัติแทนเมื่อ ${formatThaiDate(date)} ${time} น. เวลาสิ้นสุดต้องหลังจากนั้น`, 422)
      }
      assertNoAbsenceOverlap(item.mentor, item.startAt, endAt, id)
      item.endAt = endAt
      return toAbsence(item, Date.parse(now()))
    },

    async cancelMentorAbsence(id) {
      const actor = await authorise()
      const item = db.absences.find(entry => entry.id === id)
      if (!item) throw new ApiError('ไม่พบช่วงเวลานี้', 404)
      if (item.type !== 'absent') throw new ApiError('ช่วงที่พี่เลี้ยงแจ้งเองยกเลิกจากหน้านี้ไม่ได้', 422)
      if (item.cancelledAt) throw new ApiError('ช่วงนี้ถูกยกเลิกแล้ว', 409)
      const at = now()
      // เริ่มแล้วอาจมีการอนุมัติแทนไปแล้ว ให้จบช่วงด้วยการปรับเวลาสิ้นสุด
      if (Date.parse(item.startAt) <= Date.parse(at)) throw new ApiError('ช่วงนี้เริ่มแล้ว ยกเลิกไม่ได้ ให้ปรับเวลาสิ้นสุดแทน', 409)
      Object.assign(item, { cancelledAt: at, cancelledBy: actor })
      return toAbsence(item, Date.parse(at))
    },

    async getProxyQueue(limit, mentorId) {
      await authorise()
      const active = activeAbsences(now())
      const mentors = active.map(item => ({ id: accountIdOf(item.mentor), name: item.mentor.name }))
      const overdueDays = db.settings.reviewOverdueDays
      const absence = active.find(item => accountIdOf(item.mentor) === mentorId) ?? active[0]
      if (!absence) return { mentors, items: [], total: 0, overdueCount: 0, overdueDays }

      const waiting = waitingFor(absence.mentor)

      const { mentor, startAt, endAt, reason } = absence
      return structuredClone({
        mentors,
        selected: { mentorId: accountIdOf(mentor), mentorName: mentor.name, startAt, endAt, reason },
        items: waiting.slice(0, limit),
        total: waiting.length,
        overdueCount: waiting.filter(item => item.isOverdue).length,
        overdueDays,
      })
    },

    async approveByProxy(mentorId, targets, comment) {
      const actor = await authorise()
      const at = now()
      // ตรวจจากเวลาเซิร์ฟเวอร์ตอนกดอนุมัติ (กติกาการอนุมัติแทนข้อ 1)
      const absence = activeAbsences(at).find(item => accountIdOf(item.mentor) === mentorId)
      if (!absence) throw new ApiError('พี่เลี้ยงคนนี้ไม่ได้อยู่ในช่วงไม่อยู่แล้ว จึงอนุมัติแทนไม่ได้', 403, { code: 'proxy_not_allowed' })
      if (!targets.length) throw new ApiError('เลือกรายการที่จะอนุมัติ', 422)

      const result = reviewWorklogs({
        targets,
        decision: 'approved',
        comment: comment?.trim() || undefined,
        reviewer: actor,
        proxyFor: absence.mentor,
        at,
        denied: 'รายการนี้ไม่ได้อยู่ในความดูแลของพี่เลี้ยงคนนี้',
        find: (id) => {
          for (const { profile, worklogs } of supervisedBy(absence.mentor)) {
            const worklog = worklogs.find(log => log.id === id && log.reviewStatus !== 'draft')
            if (worklog) return { student: { studentId: profile.studentId!, name: profile.name }, worklog }
          }
          return undefined
        },
      })
      db.proxyApprovals.push(...result.succeededIds.map(worklogId => ({ absenceId: absence.id, worklogId, approvedAt: at })))
      return result
    },

    async getInternships({ filter, q, page }) {
      await authorise()
      const keyword = q.trim().toLowerCase()
      const matched = db.students.map(toRow).filter(row => !keyword
        || [row.name, row.studentId, row.company ?? ''].some(value => value.toLowerCase().includes(keyword)))
      const withoutMentor = matched.filter(row => !row.mentorName)
      const withoutHours = matched.filter(row => !row.workStartTime)
      const items = filter === 'no_mentor' ? withoutMentor : filter === 'no_hours' ? withoutHours : matched
      const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(items.length / internshipPageSize)))
      return {
        items: items.slice((current - 1) * internshipPageSize, current * internshipPageSize),
        total: items.length,
        pageSize: internshipPageSize,
        counts: { all: matched.length, no_mentor: withoutMentor.length, no_hours: withoutHours.length },
      }
    },

    async getInternshipDetail(studentId) {
      await authorise()
      return toDetail(findStudent(studentId))
    },

    async saveInternship(studentId, input) {
      await authorise()
      const record = findStudent(studentId)
      const problem = Object.values(internshipErrors(input)).find(Boolean)
      if (problem) throw new ApiError(problem, 422)
      if (![input.startDate, input.endDate].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value))
        || ![input.workStartTime, input.workEndTime].every(value => /^\d{2}:\d{2}$/.test(value))) {
        throw new ApiError('รูปแบบวันที่หรือเวลาไม่ถูกต้อง', 422)
      }
      const account = mockAccounts.find(item => item.id === input.mentorId && item.profile.role === 'supervisor')
      if (!account || (account.suspended && account.profile !== record.mentor)) {
        throw new ApiError('เลือกพี่เลี้ยงที่ใช้งานอยู่', 422)
      }

      record.internship = {
        company: input.company.trim(),
        position: input.position.trim(),
        semester: record.internship?.semester ?? db.currentSemester,
        startDate: input.startDate,
        endDate: input.endDate,
        hours: nextHours(record.internship?.hours ?? [], input.startDate, input.workStartTime, input.workEndTime),
      }
      // เปลี่ยนพี่เลี้ยง: ปิดช่วงของคนเดิม งานรอตรวจตามไปคนใหม่เพราะค้นจากพี่เลี้ยงปัจจุบัน (ขอบเขตงานข้อ 3.1, 3.2)
      if (record.mentor !== account.profile) {
        const open = record.mentorHistory.find(period => !period.to)
        if (open) open.to = db.TODAY
        record.mentorHistory.unshift({ mentor: account.profile, from: db.TODAY })
        record.mentor = account.profile
      }
      return toDetail(record)
    },
  }
}
