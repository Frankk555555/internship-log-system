import { Elysia, t } from 'elysia'
import type { Pool } from 'mysql2/promise'
import { changePassword } from './auth/change-password'
import { createRateLimiter, createUnknownEmailGuard } from './auth/limits'
import { logIn } from './auth/login'
import { maxPasswordLength } from './auth/passwords'
import { deleteSession, rememberSeconds, sessionCookie } from './auth/sessions'
import type { Config } from './config'
import { HttpError } from './errors'
import { profileBySession } from './users/profile'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

/** ค่าใน cookie ที่ client ส่งมา ไม่ใช่ข้อความถือว่าไม่มี */
const tokenFrom = (value: unknown) => typeof value === 'string' && value ? value : undefined

export function createApp({ db, config }: { db: Pool, config: Config }) {
  const allowAuthRequest = createRateLimiter(config.authRateLimit)
  const unknownEmails = createUnknownEmailGuard()
  // ห้ามกำหนด domain เพราะ cookie ส่งผ่านตัวส่งต่อ /api ของ Nuxt
  const cookieOptions = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: config.cookieSecure }

  return new Elysia()
    // ทุกข้อผิดพลาดตอบเป็น { message ภาษาไทย, code? } ตาม docs/api-contract.md
    .onError(({ code, error, set }) => {
      if (error instanceof HttpError) {
        set.status = error.status
        return { message: error.message, ...error.details }
      }
      if (code === 'VALIDATION') {
        set.status = 422
        return { message: 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' }
      }
      if (code === 'PARSE') {
        set.status = 400
        return { message: 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' }
      }
      if (code === 'NOT_FOUND') {
        set.status = 404
        return { message: 'ไม่พบข้อมูลที่ขอ' }
      }
      // ไม่บันทึกเนื้อคำขอ เพราะมีรหัสผ่าน
      console.error(error instanceof Error ? error.stack : error)
      set.status = 500
      return { message: 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่' }
    })
    .onRequest(({ request, server }) => {
      // คำขอที่แก้ข้อมูลต้องมาจากหน้าเว็บของระบบ (ป้องกัน CSRF) เบราว์เซอร์ส่ง Origin เสมอ
      if (!safeMethods.has(request.method) && !config.webOrigins.includes(request.headers.get('origin') ?? '')) {
        throw new HttpError(403, 'คำขอนี้ไม่ได้มาจากหน้าเว็บของระบบ')
      }
      if (new URL(request.url).pathname.startsWith('/auth/')) {
        const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || server?.requestIP(request)?.address
          || 'unknown'
        if (!allowAuthRequest(address)) throw new HttpError(429, 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่')
      }
    })
    .post('/auth/login', async ({ body, cookie }) => {
      const session = cookie[sessionCookie]!
      const previous = tokenFrom(session.value)
      const { token, profile } = await logIn(db, unknownEmails, body)
      // เข้าสู่ระบบใหม่บนเบราว์เซอร์เดิม ตัด session เก่าทิ้ง
      if (previous) await deleteSession(db, previous)
      session.set({ ...cookieOptions, value: token, maxAge: body.remember ? rememberSeconds : undefined })
      return profile
    }, {
      body: t.Object({
        email: t.String({ minLength: 1, maxLength: 255 }),
        // จำกัดความยาว กันการส่งข้อความยาวมากให้เซิร์ฟเวอร์ hash
        password: t.String({ minLength: 1, maxLength: maxPasswordLength }),
        remember: t.Boolean(),
      }),
    })
    .post('/auth/change-password', async ({ body, cookie, set }) => {
      const token = tokenFrom(cookie[sessionCookie]!.value)
      if (!token) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ')
      await changePassword(db, token, body)
      set.status = 204
    }, {
      body: t.Object({
        currentPassword: t.String({ minLength: 1, maxLength: maxPasswordLength }),
        // ความยาวตามกติกาตรวจใน changePassword เพื่อบอกผู้ใช้ได้ว่าผิดอะไร ค่านี้กันข้อความใหญ่ผิดปกติ
        newPassword: t.String({ maxLength: 1000 }),
      }),
    })
    .post('/auth/logout', async ({ cookie, set }) => {
      const session = cookie[sessionCookie]!
      const token = tokenFrom(session.value)
      if (token) await deleteSession(db, token)
      session.set({ ...cookieOptions, value: '', maxAge: 0, expires: new Date(0) })
      set.status = 204
    })
    .get('/me', async ({ cookie }) => {
      const token = tokenFrom(cookie[sessionCookie]!.value)
      const profile = token ? await profileBySession(db, token) : undefined
      if (!profile) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ')
      return profile
    })
}

export type App = ReturnType<typeof createApp>
