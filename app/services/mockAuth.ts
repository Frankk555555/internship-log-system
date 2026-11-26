import type { AuthApi } from '~/types/auth'
import type { UserRole } from '~/types/worklog'
import { newPasswordError } from '~/utils/auth'
import { ApiError } from './api'
import { mockAccounts } from './mockAccounts'
import type { MockSession } from './mockSession'

// ล็อกบัญชีเมื่อกรอกผิด 5 ครั้ง เป็นเวลา 15 นาที (ขอบเขตงานข้อ 1.2)
const maxFailedLogins = 5
const lockMinutes = 15
const resetLinkMinutes = 30
const resendSeconds = 60

const failures = new Map<string, { count: number, lockedUntil?: number }>()
const usedTokens = new Set<string>()

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

export function requireRole(session: MockSession, role: UserRole) {
  if (currentAccount(session).profile.role !== role) {
    throw new ApiError('รายการที่ขออยู่นอกขอบเขตข้อมูลที่คุณมีสิทธิ์ดู', 403)
  }
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
      let record = failures.get(key)

      if (record?.lockedUntil) {
        if (record.lockedUntil > Date.now()) throw locked(record.lockedUntil)
        failures.delete(key)
        record = undefined
      }

      const account = findAccount(key)
      if (!account || account.password !== password) {
        // นับทุกอีเมล เพื่อไม่ให้รู้ว่ามีบัญชีนี้หรือไม่
        const count = (record?.count ?? 0) + 1
        const lockedUntil = count >= maxFailedLogins ? Date.now() + lockMinutes * 60_000 : undefined
        failures.set(key, { count, lockedUntil })
        if (lockedUntil) throw locked(lockedUntil)
        throw new ApiError('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401, { code: 'invalid_credentials' })
      }

      failures.delete(key)
      // บอกว่าถูกระงับเฉพาะเมื่อรหัสผ่านถูกต้องแล้ว (ขอบเขตงานข้อ 4.1)
      if (account.suspended) throw new ApiError('บัญชีถูกระงับ', 403, { code: 'account_suspended' })

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
      if (account && !account.suspended) {
        const token = btoa(JSON.stringify([account.profile.email, Date.now() + resetLinkMinutes * 60_000]))
        // ไม่มีการส่งอีเมลจริง แสดงลิงก์ใน console ของเบราว์เซอร์เพื่อใช้ทดสอบ
        console.info(`[mock] ลิงก์ตั้งรหัสผ่านใหม่: ${location.origin}/reset-password?token=${encodeURIComponent(token)}`)
      }
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
      const problem = newPasswordError(newPassword)
      if (problem) throw new ApiError(problem, 422)

      account.password = newPassword
      usedTokens.add(token)
      failures.delete(email)
    },

    async changePassword({ currentPassword, newPassword }) {
      await wait()
      const account = currentAccount(session)
      if (account.password !== currentPassword) throw new ApiError('รหัสผ่านปัจจุบันไม่ถูกต้อง', 422, { code: 'wrong_password' })
      const problem = newPasswordError(newPassword)
      if (problem) throw new ApiError(problem, 422)
      if (newPassword === currentPassword) throw new ApiError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน', 422)
      account.password = newPassword
    },
  }
}
