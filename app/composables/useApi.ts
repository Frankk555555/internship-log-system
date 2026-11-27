import type { Api } from '~/services/api'
import { createHttpApi } from '~/services/httpApi'
import { createMockApi } from '~/services/mockApi'
import { createMockSession } from '~/services/mockSession'

/**
 * จุดเดียวที่เลือกแหล่งข้อมูล
 * ตั้งค่า NUXT_PUBLIC_API_BASE เพื่อใช้ backend จริง ถ้าไม่ตั้งจะใช้ข้อมูลจำลอง
 */
export function useApi(): Api {
  const { apiBase } = useRuntimeConfig().public
  // ตอน render ฝั่งเซิร์ฟเวอร์ ต้องใช้ cookie ของผู้ใช้
  const headers = import.meta.server ? useRequestHeaders(['cookie']) as Record<string, string> : undefined

  if (!apiBase) return createMockApi(createMockSession(headers?.cookie))

  const user = useSessionUser()
  const router = useRouter()
  return createHttpApi(apiBase, headers, () => {
    user.value = null
    router.push('/login')
  })
}
