// ส่งต่อ /api/** ไป backend เบราว์เซอร์จึงคุยกับโดเมนเดียวกับหน้าเว็บ ใช้ session cookie ได้โดยไม่ต้องตั้ง CORS
import { clientAddress } from '#shared/utils/forwarding'

/** นานพอสำหรับอัปโหลดไฟล์ */
const timeoutMs = 120_000

export default defineEventHandler(async (event) => {
  const { apiServerUrl, trustForwardedFor } = useRuntimeConfig(event)
  // โหมดข้อมูลจำลองไม่มี backend ให้ส่งต่อ
  if (!apiServerUrl) {
    setResponseStatus(event, 404)
    return { message: 'ยังไม่ได้ตั้งค่าที่อยู่ของเซิร์ฟเวอร์ (NUXT_API_SERVER_URL)' }
  }

  const base = new URL(apiServerUrl)
  const prefix = base.pathname.replace(/\/+$/, '')
  const target = new URL(`${base.origin}${prefix}${event.path.slice('/api'.length)}`)
  // เส้นทางอย่าง /api/../ ต้องไม่หลุดไปนอกที่อยู่ที่กำหนด
  if (target.origin !== base.origin || !target.pathname.startsWith(`${prefix}/`)) {
    setResponseStatus(event, 404)
    return { message: 'ไม่พบข้อมูลที่ขอ' }
  }

  const address = clientAddress(event.node.req.socket?.remoteAddress, getRequestHeader(event, 'x-forwarded-for'), trustForwardedFor)
  // ค่าที่ client ส่งมาบอก IP ตัวเองเชื่อไม่ได้
  const incoming = event.node.req.headers
  delete incoming['x-forwarded-for']
  delete incoming['x-real-ip']
  delete incoming.forwarded

  try {
    await proxyRequest(event, target.href, {
      headers: address ? { 'x-forwarded-for': address } : {},
      fetchOptions: { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) },
    })
  }
  catch (error) {
    console.error(`[api proxy] ${event.method} ${target.pathname}`, (error as Error).cause ?? error)
    // ส่งคำตอบไปบางส่วนแล้ว เปลี่ยนสถานะไม่ได้
    if (event.node.res.headersSent) return event.node.res.end()
    // ข้อความที่หน้าจอแสดงได้ ไม่ส่งรายละเอียดภายในออกไป
    setResponseStatus(event, 502)
    return { message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่' }
  }
})
