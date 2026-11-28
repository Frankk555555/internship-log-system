import type { Api } from '~/services/api'
import { createHttpApi } from '~/services/httpApi'
import { createLazyApi } from '~/services/lazyApi'
import { createMockSession } from '~/services/mockSession'

/**
 * จุดเดียวที่เลือกแหล่งข้อมูล
 * ตั้งค่า NUXT_PUBLIC_API_BASE เพื่อใช้ backend จริง ถ้าไม่ตั้งจะใช้ข้อมูลจำลอง
 */
export function useApi(): Api {
  const config = useRuntimeConfig()
  const { apiBase } = config.public
  const server = import.meta.server ? useServerForwarding() : undefined

  if (!apiBase) {
    const session = createMockSession(server?.headers().cookie)
    // โหลดข้อมูลจำลองเฉพาะเมื่อใช้จริง ต่อ backend แล้วเบราว์เซอร์ไม่ต้องดาวน์โหลด
    return createLazyApi(async () => (await import('~/services/mockApi')).createMockApi(session))
  }

  const user = useSessionUser()
  const router = useRouter()
  return createHttpApi({
    // ฝั่งเซิร์ฟเวอร์เรียก backend ตรง เบราว์เซอร์เรียกผ่านที่อยู่สาธารณะ เช่น /api
    baseURL: import.meta.server && config.apiServerUrl ? config.apiServerUrl : apiBase,
    headers: server?.headers,
    onResponseCookies: server?.keepCookies,
    // ฝั่งเซิร์ฟเวอร์ไม่ลองซ้ำเอง หน้าเว็บจะได้ไม่ค้างนาน
    retry: import.meta.server ? 0 : undefined,
    onSessionExpired: () => {
      user.value = null
      router.push('/login')
    },
    onPasswordChangeRequired: () => {
      if (user.value) user.value = { ...user.value, mustChangePassword: true }
      router.push(firstPasswordPath)
    },
  })
}
