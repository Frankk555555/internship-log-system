import { ApiError } from '~/services/api'
import type { ChangePasswordInput, LoginInput, UpdateProfileInput } from '~/types/auth'
import type { UserProfile } from '~/types/worklog'

/** ผู้ใช้ที่เข้าสู่ระบบอยู่ ใช้ร่วมกันทั้งแอป (โหลดโดย middleware auth) */
export function useSessionUser() {
  return useState<UserProfile | null>('session-user', () => null)
}

/** เวลาปลดล็อกของบัญชีที่เพิ่งถูกล็อกและออกจากระบบ ให้หน้าเข้าสู่ระบบแสดง */
export function useLockNotice() {
  return useState<string | undefined>('lock-notice', () => undefined)
}

export function useSession() {
  const api = useApi()
  const user = useSessionUser()
  const lockNotice = useLockNotice()
  const { toasts } = useToast()

  /**
   * คืน false เมื่อกรอกรหัสปัจจุบันผิดครบจำนวนครั้ง บัญชีถูกล็อกและออกจากระบบแล้ว
   * จึงพาไปหน้าเข้าสู่ระบบ ผู้เรียกไม่ต้องแสดงอะไรต่อ
   */
  async function changePassword(input: ChangePasswordInput) {
    try {
      await api.changePassword(input)
      return true
    }
    catch (error) {
      if (!(error instanceof ApiError && error.code === 'account_locked' && error.lockedUntil)) throw error
      lockNotice.value = error.lockedUntil
      user.value = null
      toasts.value = []
      await navigateTo('/login', { replace: true })
      return false
    }
  }

  return {
    user,
    async login(input: LoginInput) {
      user.value = await api.login(input)
      // ล้างข้อมูลที่โหลดไว้ของผู้ใช้คนก่อน
      clearNuxtData()
      return user.value
    },
    async updateProfile(input: UpdateProfileInput) {
      user.value = await api.updateProfile(input)
      // ข้อมูลที่โหลดไว้อาจยังมีชื่อเดิม
      clearNuxtData()
      return user.value
    },
    changePassword,
    /** เปลี่ยนรหัสผ่านเริ่มต้น แล้วอ่านผู้ใช้ใหม่เพื่อปลดการบังคับ ไม่คืนผู้ใช้เมื่อบัญชีถูกล็อก */
    async changeFirstPassword(input: ChangePasswordInput) {
      if (!await changePassword(input)) return undefined
      user.value = await api.getMe()
      clearNuxtData()
      return user.value
    },
    async logout() {
      await api.logout()
      user.value = null
      // ข้อความแจ้งเตือนของผู้ใช้คนเดิมต้องไม่ค้างให้คนถัดไปเห็น
      toasts.value = []
    },
  }
}
