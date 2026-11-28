import type { AuthApi } from '~/types/auth'
import type { UserRole } from '~/types/worklog'
import { nameError, newPasswordError } from '~/utils/auth'
import { ApiError } from './api'
import { mockAccounts, type MockAccount } from './mockAccounts'
import { renameUser, settings } from './mockData'
import type { MockSession } from './mockSession'

const resetLinkMinutes = 30
const resendSeconds = 60

const failures = new Map<string, { count: number, lockedUntil?: number }>()
const usedTokens = new Set<string>()

// ตัวอย่างบัญชีที่ถูกล็อก ให้ลองปลดล็อกในหน้าผู้ใช้งานได้
failures.set('napha.s@university.ac.th', { count: settings.maxFailedLogins, lockedUntil: Date.now() + settings.lockMinutes * 60_000 })

const wait = () => new Promise(resolve => setTimeout(resolve, 150))
const normalize = (email: string) => email.trim().toLowerCase()
const findAccount = (email?: string) => mockAccounts.find(account => account.profile.email === email)

function locked(until: number) {
  return new ApiError('บัญชีถูกล็อกชั่วคราว', 423, { code: 'account_locked', lockedUntil: new Date(until).toISOString() })
}

export function currentAccount(session: MockSession) {
  const account = findAccount(session.read())
  if (!account || account.suspended) throw new ApiError('กรุณาเข้าสู่ระบบ', 401)
  return account
}

/** บัญชีที่ใช้ข้อมูลได้ บัญชีที่ยังใช้รหัสผ่านเริ่มต้นต้องตั้งรหัสใหม่ก่อน */
export function activeAccount(session: MockSession) {
  const account = currentAccount(session)
  if (account.profile.mustChangePassword) {
    throw new ApiError('กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน', 403, { code: 'password_change_required' })
  }
  return account
}

export function requireRole(session: MockSession, role: UserRole) {
  if (activeAccount(session).profile.role !== role) {
    throw new ApiError('รายการที่ขออยู่นอกขอบเขตข้อมูลที่คุณมีสิทธิ์ดู', 403)
  }
}

/** เวลาที่ปลดล็อก ไม่มีค่า = ไม่ได้ถูกล็อก */
export function lockedUntilFor(email: string) {
  const until = failures.get(email)?.lockedUntil
  return until && until > Date.now() ? until : undefined
}

export function clearFailures(email: string) {
  failures.delete(email)
}

/** บันทึกการกรอกรหัสผิดหนึ่งครั้ง คืนเวลาปลดล็อกเมื่อครบจำนวนครั้ง (ขอบเขตงานข้อ 1.2) */
function recordFailure(email: string) {
  const record = failures.get(email)
  // พ้นเวลาล็อกแล้วเริ่มนับใหม่
  const count = (record?.lockedUntil ? 0 : record?.count ?? 0) + 1
  const lockedUntil = count >= settings.maxFailedLogins ? Date.now() + settings.lockMinutes * 60_000 : undefined
  failures.set(email, { count, lockedUntil })
  return lockedUntil
}

/** ไม่มีการส่งอีเมลจริง แสดงลิงก์ใน console ของเบราว์เซอร์เพื่อใช้ทดสอบ */
export function sendResetLink(account: MockAccount) {
  const token = btoa(JSON.stringify([account.profile.email, Date.now() + resetLinkMinutes * 60_000]))
  console.info(`[mock] ลิงก์ตั้งรหัสผ่านใหม่: ${location.origin}/reset-password?token=${encodeURIComponent(token)}`)
}

function setPassword(account: MockAccount, password: string) {
  account.password = password
  account.profile.mustChangePassword = false
}

export function createMockAuth(session: MockSession): AuthApi {
  return {
    async getMe() {
      await wait()
      return structuredClone(currentAccount(session).profile)
    },

    async login({ email, password, remember }) {
      await wait()
      const key = normalize(email)
      const until = lockedUntilFor(key)
      if (until) throw locked(until)

      const account = findAccount(key)
      if (!account || account.password !== password) {
        // นับทุกอีเมล เพื่อไม่ให้รู้ว่ามีบัญชีนี้หรือไม่
        const lockedUntil = recordFailure(key)
        if (lockedUntil) throw locked(lockedUntil)
        throw new ApiError('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401, { code: 'invalid_credentials' })
      }

      failures.delete(key)
      // บอกว่าถูกระงับเฉพาะเมื่อรหัสผ่านถูกต้องแล้ว (ขอบเขตงานข้อ 4.1)
      if (account.suspended) throw new ApiError('บัญชีถูกระงับ', 403, { code: 'account_suspended' })

      account.lastLoginAt = new Date().toISOString()
      session.write(key, remember)
      return structuredClone(account.profile)
    },

    async logout() {
      await wait()
      session.write(undefined)
    },

    async requestPasswordReset(email) {
      await wait()
      const account = findAccount(normalize(email))
      if (account && !account.suspended) sendResetLink(account)
      return { resendAfterSeconds: resendSeconds, expiresInMinutes: resetLinkMinutes }
    },

    async resetPassword(token, newPassword) {
      await wait()
      const invalid = new ApiError('ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่', 410, { code: 'invalid_token' })
      let email: string
      let expiresAt: number
      try {
        [email, expiresAt] = JSON.parse(atob(token))
      }
      catch {
        throw invalid
      }
      const account = findAccount(email)
      if (!account || usedTokens.has(token) || !(expiresAt > Date.now())) throw invalid
      const problem = newPasswordError(newPassword, account.profile.studentId)
      if (problem) throw new ApiError(problem, 422)

      setPassword(account, newPassword)
      usedTokens.add(token)
      failures.delete(email)
    },

    async changePassword({ currentPassword, newPassword }) {
      await wait()
      const account = currentAccount(session)
      const { email } = account.profile
      if (lockedUntilFor(email)) throw new ApiError('บัญชีถูกล็อกชั่วคราว จึงยังเปลี่ยนรหัสผ่านไม่ได้ กรุณาลองใหม่ภายหลัง', 423)
      if (account.password !== currentPassword) {
        // นับรวมกับการเข้าสู่ระบบ ครบจำนวนครั้งแล้วล็อกและออกจากระบบ
        const lockedUntil = recordFailure(email)
        if (!lockedUntil) throw new ApiError('รหัสผ่านปัจจุบันไม่ถูกต้อง', 422, { code: 'wrong_password' })
        session.write(undefined)
        throw locked(lockedUntil)
      }
      failures.delete(email)
      const problem = newPasswordError(newPassword, account.profile.studentId)
      if (problem) throw new ApiError(problem, 422)
      if (newPassword === currentPassword) throw new ApiError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน', 422)
      setPassword(account, newPassword)
    },

    async updateProfile(input) {
      await wait()
      const account = activeAccount(session)
      const firstName = input.firstName.trim()
      const lastName = input.lastName.trim()
      const problem = nameError(firstName, 'ชื่อ') ?? nameError(lastName, 'นามสกุล')
      if (problem) throw new ApiError(problem, 422)
      renameUser(account.profile, firstName, lastName)
      return structuredClone(account.profile)
    },
  }
}
