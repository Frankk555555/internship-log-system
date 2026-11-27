// ข้อมูลจำลองของแอดมิน โหลดพร้อม mockApi เมื่อใช้ข้อมูลจำลองเท่านั้น
import type { AdminApi, AdminUser, UserInput } from '~/types/admin'
import { settingDayError, userInputErrors } from '~/utils/adminRules'
import { ApiError } from './api'
import { mockAccounts, type MockAccount } from './mockAccounts'
import { clearFailures, currentAccount, lockedUntilFor, requireRole, sendResetLink } from './mockAuth'
import * as db from './mockData'
import { reassignStudent } from './mockNotifications'
import type { MockSession } from './mockSession'

const userPageSize = 8
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
  }
}
