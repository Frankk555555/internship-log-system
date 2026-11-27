import type { Api } from '~/services/api'
import { createHttpApi } from '~/services/httpApi'
import { createLazyApi } from '~/services/lazyApi'
import { createMockSession } from '~/services/mockSession'

/**
 * จุดเดียวที่เลือกแหล่งข้อมูล
 * ตั้งค่า NUXT_PUBLIC_API_BASE เพื่อใช้ backend จริง ถ้าไม่ตั้งจะใช้ข้อมูลจำลอง
 */
export function useApi(): Api {
  const { apiBase } = useRuntimeConfig().public
  // ตอน render ฝั่งเซิร์ฟเวอร์ ต้องใช้ cookie ของผู้ใช้
  const headers = import.meta.server ? useRequestHeaders(['cookie']) as Record<string, string> : undefined

  if (!apiBase) {
    const session = createMockSession(headers?.cookie)
    // โหลดข้อมูลจำลองเฉพาะเมื่อใช้จริง ต่อ backend แล้วเบราว์เซอร์ไม่ต้องดาวน์โหลด
    return createLazyApi(async () => (await import('~/services/mockApi')).createMockApi(session))
  }

  const user = useSessionUser()
  const router = useRouter()
  return createHttpApi(apiBase, headers, () => {
    user.value = null
    router.push('/login')
  }, () => {
    if (user.value) user.value = { ...user.value, mustChangePassword: true }
    router.push(firstPasswordPath)
  })
}
