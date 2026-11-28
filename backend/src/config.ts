/** ค่าตั้งของ backend อ่านจาก environment (Bun อ่านไฟล์ backend/.env ให้เอง) ดู .env.example */
export interface Config {
  host: string
  port: number
  databaseUrl: string
  /** ที่อยู่ของหน้าเว็บที่ส่งคำขอแก้ข้อมูลได้ ตรวจจาก header Origin */
  webOrigins: string[]
  cookieSecure: boolean
  /** จำนวนคำขอ /auth/* ต่อ IP ต่อนาที */
  authRateLimit: number
}

function positiveInteger(name: string, value: string | undefined, fallback: number) {
  if (!value) return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) throw new Error(`${name} ต้องเป็นจำนวนเต็มบวก`)
  return number
}

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  if (!env.DATABASE_URL) throw new Error('ยังไม่ได้ตั้ง DATABASE_URL (ดู backend/.env.example)')
  const webOrigins = (env.WEB_ORIGIN || 'http://localhost:3000')
    .split(',').map(origin => origin.trim().replace(/\/+$/, '')).filter(Boolean)

  return {
    // รับคำขอจากเครื่องเดียวกัน (Nuxt) เท่านั้น เพราะเชื่อ X-Forwarded-For ที่ Nuxt ส่งมา
    host: env.HOST || '127.0.0.1',
    port: positiveInteger('PORT', env.PORT, 4000),
    databaseUrl: env.DATABASE_URL,
    webOrigins,
    // ปิดได้เฉพาะตอนพัฒนาผ่าน http
    cookieSecure: env.COOKIE_SECURE !== 'false',
    authRateLimit: positiveInteger('AUTH_RATE_LIMIT', env.AUTH_RATE_LIMIT, 30),
  }
}
