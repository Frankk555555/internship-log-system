import { ApiError } from '~/services/api'
import type { UserRole } from '~/types/worklog'

declare module '#app' {
  interface PageMeta {
    /** เปิดได้โดยไม่ต้องเข้าสู่ระบบ */
    public?: boolean
    /** บทบาทที่เปิดหน้านี้ได้ ไม่ระบุ = ทุกบทบาทที่เข้าสู่ระบบ */
    role?: UserRole | UserRole[]
  }
}

// การกันหน้าฝั่ง client ช่วยเรื่องการใช้งานเท่านั้น backend ต้องตรวจสิทธิ์ทุกคำขอเอง
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.public) return

  const user = useSessionUser()
  if (!user.value) {
    const api = useApi()
    try {
      user.value = await api.getMe()
    }
    catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        return navigateTo({ path: '/login', query: to.path === '/' ? {} : { redirect: to.fullPath } })
      }
      // ต่อเซิร์ฟเวอร์ไม่ได้: ปล่อยให้หน้าแสดงสถานะผิดพลาดและปุ่มลองใหม่
      return
    }
  }

  if (to.meta.role && ![to.meta.role].flat().includes(user.value.role)) return navigateTo('/forbidden', { replace: true })
})
