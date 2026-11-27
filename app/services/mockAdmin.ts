// ข้อมูลจำลองของแอดมิน โหลดพร้อม mockApi เมื่อใช้ข้อมูลจำลองเท่านั้น
import type { AdminApi, AdminUser, InternshipDetail, InternshipRow, UserInput } from '~/types/admin'
import { internshipErrors, settingDayError, userInputErrors } from '~/utils/adminRules'
import { workHoursOn } from '~/utils/worklogRules'
import { ApiError } from './api'
import { mockAccounts, type MockAccount } from './mockAccounts'
import { clearFailures, currentAccount, lockedUntilFor, requireRole, sendResetLink } from './mockAuth'
import * as db from './mockData'
import { reassignStudent } from './mockNotifications'
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

/** now: เวลาเซิร์ฟเวอร์จำลอง ใช้บันทึกว่าแก้เมื่อไร */
export function createMockAdmin(session: MockSession, now: () => string): AdminApi {
  /** ทุกคำขอต้องเป็นแอดมิน คืนข้อมูลผู้ที่ทำรายการ */
  async function authorise() {
    await wait()
    requireRole(session, 'admin')
    db.refreshToday()
    return currentAccount(session).profile
  }

  return {
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
      const isStudent = input.role === 'student'
      const account: MockAccount = {
        id: Math.max(...mockAccounts.map(item => item.id)) + 1,
        // นักศึกษาเริ่มด้วยรหัสนักศึกษา บทบาทอื่นยังเข้าไม่ได้จนกว่าจะตั้งรหัสจากลิงก์
        password: next.studentId ?? crypto.randomUUID(),
        profile: {
          ...next,
          name: `${next.firstName} ${next.lastName}`,
          initials: '',
          role: input.role,
          mustChangePassword: isStudent,
          defaultReportDate: db.TODAY,
        },
      }
      db.applyUserChange(account.profile, next)
      mockAccounts.unshift(account)
      if (isStudent) db.students.push({ profile: account.profile, mentorHistory: [], worklogs: [] })
      if (!isStudent) sendResetLink(account)
      return toAdminUser(account)
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
