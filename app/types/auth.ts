import type { UserProfile } from './worklog'

export interface LoginInput {
  email: string
  password: string
  /** จดจำการเข้าสู่ระบบ: คง session ไว้หลังปิดเบราว์เซอร์ */
  remember: boolean
}

export interface PasswordResetTicket {
  /** รอกี่วินาทีจึงขอลิงก์ใหม่ได้ */
  resendAfterSeconds: number
  /** อายุของลิงก์ */
  expiresInMinutes: number
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfileInput {
  firstName: string
  lastName: string
}

export interface AuthApi {
  /** ผู้ใช้ของ session ปัจจุบัน ถ้าไม่มีให้ตอบ 401 */
  getMe(): Promise<UserProfile>
  /** ผิดพลาดด้วย ApiError code: invalid_credentials, account_locked (มี lockedUntil), account_suspended */
  login(input: LoginInput): Promise<UserProfile>
  logout(): Promise<void>
  /** ตอบสำเร็จเสมอ ไม่เปิดเผยว่ามีบัญชีของอีเมลนี้หรือไม่ */
  requestPasswordReset(email: string): Promise<PasswordResetTicket>
  resetPassword(token: string, newPassword: string): Promise<void>
  changePassword(input: ChangePasswordInput): Promise<void>
  /** แก้ชื่อและนามสกุลของตนเอง คืนข้อมูลผู้ใช้ล่าสุด */
  updateProfile(input: UpdateProfileInput): Promise<UserProfile>
}
