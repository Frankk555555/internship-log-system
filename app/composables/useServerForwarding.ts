import { clientAddress, mergeCookies } from '#shared/utils/forwarding'

/**
 * ตอน render ฝั่งเซิร์ฟเวอร์ Nuxt เรียก backend แทนเบราว์เซอร์: ส่ง cookie, user agent และ IP ของผู้ใช้ไป
 * และส่ง Set-Cookie ที่ได้กลับถึงเบราว์เซอร์ (backend อาจต่ออายุหรือเปลี่ยน session)
 * ต้องเรียกใน setup หรือ middleware
 */
export function useServerForwarding() {
  const event = useRequestEvent()
  if (!event) return undefined
  const { trustForwardedFor } = useRuntimeConfig()
  const incoming = useRequestHeaders(['cookie', 'user-agent', 'x-forwarded-for'])
  const address = clientAddress(event.node.req.socket?.remoteAddress, incoming['x-forwarded-for'], trustForwardedFor)

  // เก็บไว้กับคำขอ ทุกการเรียกใน render เดียวกันเห็น cookie ชุดล่าสุด
  const context = event.context as { apiCookie?: string }
  const cookie = () => context.apiCookie ?? incoming.cookie ?? ''

  return {
    headers() {
      const values = { 'cookie': cookie(), 'user-agent': incoming['user-agent'], 'x-forwarded-for': address }
      return Object.fromEntries(Object.entries(values).filter(([, value]) => value)) as Record<string, string>
    },
    keepCookies(setCookies: string[]) {
      if (!setCookies.length) return
      context.apiCookie = mergeCookies(cookie(), setCookies)
      if (event.node.res.headersSent) return
      for (const value of setCookies) event.node.res.appendHeader('set-cookie', value)
    },
  }
}
