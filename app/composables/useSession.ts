import type { LoginInput, UpdateProfileInput } from '~/types/auth'
import type { UserProfile } from '~/types/worklog'

/** ผู้ใช้ที่เข้าสู่ระบบอยู่ ใช้ร่วมกันทั้งแอป (โหลดโดย middleware auth) */
export function useSessionUser() {
  return useState<UserProfile | null>('session-user', () => null)
}

export function useSession() {
  const api = useApi()
  const user = useSessionUser()
  const { toasts } = useToast()

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
    async logout() {
      await api.logout()
      user.value = null
      // ข้อความแจ้งเตือนของผู้ใช้คนเดิมต้องไม่ค้างให้คนถัดไปเห็น
      toasts.value = []
    },
  }
}
