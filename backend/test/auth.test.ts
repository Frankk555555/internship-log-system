// ทดสอบกับฐานข้อมูลจริง ต้องตั้ง TEST_DATABASE_URL ชี้ฐานข้อมูลที่ชื่อลงท้าย _test และสร้างตารางจาก db/schema.sql แล้ว
// ระวัง: ลบผู้ใช้และ session ทั้งหมดในฐานข้อมูลนั้น
import { afterAll, beforeAll, beforeEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { createApp } from '../src/app'
import { hashPassword } from '../src/auth/passwords'
import { hashToken, sessionCookie } from '../src/auth/sessions'
import type { Config } from '../src/config'
import { createDatabase } from '../src/database'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('ตั้ง TEST_DATABASE_URL ให้ชี้ฐานข้อมูลที่ชื่อลงท้าย _test (ดู backend/README.md)')
}

// หลายข้อ hash รหัสผ่านจริงหลายครั้ง เครื่องที่ช้าหรือฐานข้อมูลที่เพิ่งเปิดอาจเกินค่าเริ่มต้น 5 วินาที
setDefaultTimeout(30_000)

const origin = 'http://localhost:3000'
const config: Config = { host: '127.0.0.1', port: 0, databaseUrl: url, webOrigins: [origin], cookieSecure: true, authRateLimit: 1000 }
const db = createDatabase(url)
// สุ่มใหม่ทุกครั้ง ไม่มีรหัสผ่านอยู่ใน repo
const password: string = crypto.randomUUID()
const wrong = `${password}-wrong`

let app = createApp({ db, config })
let hash = ''

interface CallOptions {
  body?: unknown
  raw?: string
  cookie?: string
  origin?: string | null
  headers?: Record<string, string>
}

async function call(method: string, path: string, options: CallOptions = {}) {
  const headers: Record<string, string> = { ...options.headers }
  const from = options.origin === undefined ? origin : options.origin
  if (from) headers.origin = from
  if (options.cookie) headers.cookie = options.cookie
  const body = options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body))
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await app.handle(new Request(`http://backend${path}`, { method, headers, body }))
  const text = await response.text()
  const setCookie = response.headers.getSetCookie()
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
    setCookie,
    /** header "cookie" สำหรับคำขอถัดไป */
    cookie: setCookie[0]?.split(';')[0],
  }
}

const login = (email: string, secret = password, remember = false, cookie?: string) =>
  call('POST', '/auth/login', { body: { email, password: secret, remember }, cookie })

async function addUser(email: string, options: { role?: number, code?: string, active?: boolean, mustChange?: boolean, noPassword?: boolean } = {}) {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO users (role_id, email, password_hash, first_name, last_name, is_active, must_change_password, updated_at)
     VALUES (?, ?, ?, 'เอก', 'ใจดี', ?, ?, '2020-01-01 00:00:00')`,
    [options.role ?? 1, email, options.noPassword ? null : hash, options.active ?? true, options.mustChange ?? false],
  )
  if (options.code) await db.execute('INSERT INTO students_detail (user_id, student_code) VALUES (?, ?)', [result.insertId, options.code])
  return result.insertId
}

async function row(sql: string, values: (string | number)[] = []) {
  const [rows] = await db.execute<RowDataPacket[]>(sql, values)
  return rows[0]!
}

const userRow = (id: number) => row('SELECT * FROM users WHERE user_id = ?', [id])
const sessionCount = async () => Number((await row('SELECT COUNT(*) AS n FROM sessions')).n)
const secondsLeft = async (token: string) => Number((await row(
  'SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at) AS s FROM sessions WHERE token_hash = ?', [hashToken(token)],
)).s)
const tokenOf = (cookie: string) => cookie.slice(`${sessionCookie}=`.length)

async function clear() {
  await db.query('DELETE FROM password_reset_tokens')
  await db.query('DELETE FROM sessions')
  await db.query('DELETE FROM students_detail')
  await db.query('DELETE FROM users')
}

beforeAll(async () => { hash = await hashPassword(password) })
beforeEach(async () => {
  await clear()
  app = createApp({ db, config })
})
afterAll(async () => {
  await clear()
  await db.end()
})

describe('การเชื่อมต่อฐานข้อมูล', () => {
  test('ใช้ UTC โหมดเข้มงวด และคืนวันเวลาเป็นข้อความ', async () => {
    const settings = await row('SELECT @@session.time_zone AS zone, @@session.sql_mode AS mode, CAST(\'2026-11-28\' AS DATE) AS day')
    expect(settings.zone).toBe('+00:00')
    expect(settings.mode).toContain('STRICT_ALL_TABLES')
    expect(settings.day).toBe('2026-11-28')
  })
})

describe('เข้าสู่ระบบ', () => {
  test('สำเร็จ: คืนข้อมูลผู้ใช้และตั้ง cookie ที่ script อ่านไม่ได้', async () => {
    const id = await addUser('a@test.local', { code: '66000000001' })
    const result = await login('a@test.local')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      name: 'เอก ใจดี', firstName: 'เอก', lastName: 'ใจดี', email: 'a@test.local', initials: 'อจ',
      studentId: '66000000001', role: 'student', mustChangePassword: false,
      defaultReportDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
    expect(result.setCookie).toHaveLength(1)
    const attributes = result.setCookie[0]!.toLowerCase()
    expect(attributes).toContain('httponly')
    expect(attributes).toContain('samesite=lax')
    expect(attributes).toContain('secure')
    expect(attributes).toContain('path=/')
    expect(attributes).not.toContain('domain=')
    expect(attributes).not.toContain('max-age')
    expect(attributes).not.toContain('expires')

    const stored = await row('SELECT token_hash, remember FROM sessions')
    expect(stored.token_hash).toBe(hashToken(tokenOf(result.cookie!)))
    expect(stored.remember).toBe(0)
    const left = await secondsLeft(tokenOf(result.cookie!))
    expect(left).toBeGreaterThan(12 * 3600 - 60)
    expect(left).toBeLessThanOrEqual(12 * 3600)

    const account = await userRow(id)
    expect(account.last_login_at).not.toBeNull()
    expect(account.updated_at).toBe('2020-01-01 00:00:00')
  })

  test('จดจำการเข้าสู่ระบบ: คง 7 วันทั้ง cookie และ session', async () => {
    await addUser('a@test.local')
    const result = await login('a@test.local', password, true)

    expect(result.setCookie[0]!.toLowerCase()).toContain(`max-age=${7 * 86400}`)
    const left = await secondsLeft(tokenOf(result.cookie!))
    expect(left).toBeGreaterThan(7 * 86400 - 60)
    expect(left).toBeLessThanOrEqual(7 * 86400)
  })

  test('ไม่สนตัวพิมพ์และช่องว่างหัวท้ายของอีเมล', async () => {
    await addUser('a@test.local', { role: 3 })
    const result = await login('  A@Test.Local ')
    expect(result.status).toBe(200)
    expect(result.body.role).toBe('admin')
    expect(result.body).not.toHaveProperty('studentId')
  })

  test('บัญชีที่ยังใช้รหัสเริ่มต้นแจ้ง mustChangePassword', async () => {
    await addUser('a@test.local', { mustChange: true })
    expect((await login('a@test.local')).body.mustChangePassword).toBe(true)
  })

  test('รหัสผิด อีเมลที่ไม่มี และบัญชีที่ยังไม่ตั้งรหัส ตอบเหมือนกัน', async () => {
    await addUser('a@test.local')
    await addUser('new@test.local', { noPassword: true, role: 2 })
    for (const result of [await login('a@test.local', wrong), await login('nobody@test.local'), await login('new@test.local')]) {
      expect(result.status).toBe(401)
      expect(result.body).toEqual({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', code: 'invalid_credentials' })
      expect(result.setCookie).toHaveLength(0)
    }
    expect(await sessionCount()).toBe(0)
  })

  test('ผิดครบ 5 ครั้งล็อก 15 นาที รหัสถูกก็เข้าไม่ได้ พ้นเวลาแล้วเริ่มนับใหม่', async () => {
    const id = await addUser('a@test.local')
    for (let i = 0; i < 4; i++) expect((await login('a@test.local', wrong)).status).toBe(401)

    const fifth = await login('a@test.local', wrong)
    expect(fifth.status).toBe(423)
    expect(fifth.body.code).toBe('account_locked')
    const minutes = (Date.parse(fifth.body.lockedUntil) - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(14)
    expect(minutes).toBeLessThanOrEqual(15.1)

    const correct = await login('a@test.local')
    expect(correct.status).toBe(423)
    expect(correct.body.lockedUntil).toBe(fifth.body.lockedUntil)
    expect(await sessionCount()).toBe(0)

    await db.execute('UPDATE users SET locked_until = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE user_id = ?', [id])
    expect((await login('a@test.local', wrong)).status).toBe(401)
    expect((await userRow(id)).failed_login_count).toBe(1)
    expect((await login('a@test.local')).status).toBe(200)
    expect(await userRow(id)).toMatchObject({ failed_login_count: 0, locked_until: null })
  })

  test('อีเมลที่ไม่มีบัญชีถูกล็อกแบบเดียวกัน', async () => {
    const statuses = []
    for (let i = 0; i < 6; i++) statuses.push((await login('nobody@test.local')).status)
    expect(statuses).toEqual([401, 401, 401, 401, 423, 423])
  })

  test('ยิงพร้อมกันก็นับครบและล็อกตามกำหนด', async () => {
    const id = await addUser('a@test.local')
    const results = await Promise.all(Array.from({ length: 12 }, () => login('a@test.local', wrong)))
    expect(results.filter(result => result.status === 401)).toHaveLength(4)
    expect(results.filter(result => result.status === 423)).toHaveLength(8)
    expect((await userRow(id)).failed_login_count).toBe(5)
  })

  test('บัญชีระงับ: บอกเมื่อรหัสถูกเท่านั้น', async () => {
    await addUser('a@test.local', { active: false })
    expect((await login('a@test.local', wrong)).body.code).toBe('invalid_credentials')
    const result = await login('a@test.local')
    expect(result.status).toBe(403)
    expect(result.body.code).toBe('account_suspended')
    expect(await sessionCount()).toBe(0)
  })

  test('เข้าสู่ระบบใหม่บนเบราว์เซอร์เดิมตัด session เก่า', async () => {
    await addUser('a@test.local')
    const first = await login('a@test.local')
    const second = await login('a@test.local', password, false, first.cookie)
    expect(second.cookie).not.toBe(first.cookie)
    expect(await sessionCount()).toBe(1)
    expect((await call('GET', '/me', { cookie: first.cookie })).status).toBe(401)
  })

  test('ข้อมูลไม่ครบ ชนิดผิด ยาวเกิน หรือไม่ใช่ JSON', async () => {
    for (const body of [{}, { email: 'a@test.local', password }, { email: 'a@test.local', password: '', remember: false },
      { email: 'a@test.local', password: 'x'.repeat(129), remember: false }, { email: 5, password, remember: false }]) {
      const result = await call('POST', '/auth/login', { body })
      expect(result.status).toBe(422)
      expect(result.body).toEqual({ message: 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' })
    }
    const broken = await call('POST', '/auth/login', { raw: '{' })
    expect(broken.status).toBe(400)
    expect(broken.body.message).toBe('ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่')
  })
})

describe('/me และออกจากระบบ', () => {
  test('คืนผู้ใช้ของ session และตอบ 401 เมื่อไม่มีหรือปลอม', async () => {
    await addUser('a@test.local')
    const { cookie } = await login('a@test.local')

    const me = await call('GET', '/me', { cookie, origin: null })
    expect(me.status).toBe(200)
    expect(me.body.email).toBe('a@test.local')

    for (const bad of [undefined, `${sessionCookie}=not-a-session`, `${sessionCookie}=`]) {
      const result = await call('GET', '/me', { cookie: bad })
      expect(result.status).toBe(401)
      expect(result.body).toEqual({ message: 'กรุณาเข้าสู่ระบบ' })
    }
  })

  test('session หมดอายุหรือบัญชีถูกระงับ ใช้ต่อไม่ได้', async () => {
    const id = await addUser('a@test.local')
    const { cookie } = await login('a@test.local')

    await db.execute('UPDATE users SET is_active = FALSE WHERE user_id = ?', [id])
    expect((await call('GET', '/me', { cookie })).status).toBe(401)
    await db.execute('UPDATE users SET is_active = TRUE WHERE user_id = ?', [id])
    expect((await call('GET', '/me', { cookie })).status).toBe(200)

    await db.execute('UPDATE sessions SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND')
    expect((await call('GET', '/me', { cookie })).status).toBe(401)
    // เข้าสู่ระบบครั้งถัดไปล้างแถวที่หมดอายุ
    await login('a@test.local')
    expect(await sessionCount()).toBe(1)
  })

  test('ออกจากระบบลบ session นั้นและล้าง cookie เครื่องอื่นยังอยู่', async () => {
    await addUser('a@test.local')
    const here = await login('a@test.local')
    const elsewhere = await login('a@test.local')

    const result = await call('POST', '/auth/logout', { cookie: here.cookie })
    expect(result.status).toBe(204)
    expect(result.setCookie[0]!.toLowerCase()).toContain('max-age=0')
    expect(result.setCookie[0]!.toLowerCase()).toContain('path=/')
    expect((await call('GET', '/me', { cookie: here.cookie })).status).toBe(401)
    expect((await call('GET', '/me', { cookie: elsewhere.cookie })).status).toBe(200)

    expect((await call('POST', '/auth/logout')).status).toBe(204)
  })
})

describe('เปลี่ยนรหัสผ่าน', () => {
  const next: string = `${crypto.randomUUID()}-next`
  const change = (cookie: string | undefined, newPassword = next, currentPassword = password) =>
    call('POST', '/auth/change-password', { body: { currentPassword, newPassword }, cookie })

  test('สำเร็จ: ใช้รหัสใหม่ เลิกบังคับเปลี่ยน คง session นี้ และตัดเครื่องอื่นกับลิงก์ตั้งรหัสเดิม', async () => {
    const id = await addUser('a@test.local', { code: '66000000001', mustChange: true })
    const other = await addUser('b@test.local')
    await db.execute(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 30 MINUTE), (?, ?, UTC_TIMESTAMP() + INTERVAL 30 MINUTE)`,
      [id, hashToken('mine'), other, hashToken('theirs')],
    )
    const here = await login('a@test.local')
    const elsewhere = await login('a@test.local')
    const someoneElse = await login('b@test.local')
    await login('a@test.local', wrong)

    const result = await change(here.cookie)
    expect(result.status).toBe(204)
    expect(result.body).toBeUndefined()

    const me = await call('GET', '/me', { cookie: here.cookie })
    expect(me.status).toBe(200)
    expect(me.body.mustChangePassword).toBe(false)
    expect((await call('GET', '/me', { cookie: elsewhere.cookie })).status).toBe(401)
    expect((await call('GET', '/me', { cookie: someoneElse.cookie })).status).toBe(200)

    const account = await userRow(id)
    expect(account.password_hash).toStartWith('$argon2id$')
    expect(account.password_hash).not.toBe(hash)
    expect(account.failed_login_count).toBe(0)
    expect((await row('SELECT used_at FROM password_reset_tokens WHERE user_id = ?', [id])).used_at).not.toBeNull()
    expect((await row('SELECT used_at FROM password_reset_tokens WHERE user_id = ?', [other])).used_at).toBeNull()

    expect((await login('a@test.local')).status).toBe(401)
    expect((await login('a@test.local', next)).status).toBe(200)
  })

  test('รหัสใหม่ผิดกติกา: บอกเหตุผล ไม่เปลี่ยนอะไร', async () => {
    const id = await addUser('a@test.local', { code: '66000000001' })
    const here = await login('a@test.local')
    const elsewhere = await login('a@test.local')

    for (const [value, message] of [
      ['', 'กรุณากรอกรหัสผ่านใหม่'],
      ['1234567', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'],
      ['x'.repeat(129), 'รหัสผ่านยาวได้ไม่เกิน 128 ตัวอักษร'],
      ['66000000001', 'รหัสผ่านใหม่ต้องไม่ใช่รหัสนักศึกษา'],
      [password, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน'],
    ] as const) {
      const result = await change(here.cookie, value)
      expect(result.status).toBe(422)
      expect(result.body).toEqual({ message })
    }

    expect((await userRow(id)).password_hash).toBe(hash)
    expect((await call('GET', '/me', { cookie: elsewhere.cookie })).status).toBe(200)
    // 8 และ 128 ตัวอักษรใช้ได้
    expect((await change(here.cookie, '12345678')).status).toBe(204)
    expect((await change(here.cookie, 'y'.repeat(128), '12345678')).status).toBe(204)
  })

  test('รหัสปัจจุบันผิดนับรวมกับการเข้าสู่ระบบ ครบ 5 ครั้งล็อกและออกจากระบบทุกเครื่อง', async () => {
    const id = await addUser('a@test.local')
    const here = await login('a@test.local')
    const elsewhere = await login('a@test.local')
    for (let i = 0; i < 2; i++) await login('a@test.local', wrong)

    for (let i = 0; i < 2; i++) {
      const result = await change(here.cookie, next, wrong)
      expect(result.status).toBe(422)
      expect(result.body).toEqual({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง', code: 'wrong_password' })
    }
    const fifth = await change(here.cookie, next, wrong)
    expect(fifth.status).toBe(423)
    expect(fifth.body.code).toBe('account_locked')
    expect(Date.parse(fifth.body.lockedUntil)).toBeGreaterThan(Date.now() + 14 * 60_000)

    expect(await sessionCount()).toBe(0)
    expect((await call('GET', '/me', { cookie: elsewhere.cookie })).status).toBe(401)
    expect((await change(here.cookie)).status).toBe(401)
    expect((await login('a@test.local')).status).toBe(423)
    expect((await userRow(id)).password_hash).toBe(hash)
  })

  test('ถูกล็อกจากหน้าเข้าสู่ระบบ: session เดิมยังใช้ได้ แต่เปลี่ยนรหัสไม่ได้จนพ้นเวลา', async () => {
    const id = await addUser('a@test.local')
    const { cookie } = await login('a@test.local')
    for (let i = 0; i < 5; i++) await login('a@test.local', wrong)

    for (const current of [password, wrong]) {
      const result = await change(cookie, next, current)
      expect(result.status).toBe(423)
      expect(result.body).toEqual({ message: 'บัญชีถูกล็อกชั่วคราว จึงยังเปลี่ยนรหัสผ่านไม่ได้ กรุณาลองใหม่ภายหลัง' })
    }
    expect((await call('GET', '/me', { cookie })).status).toBe(200)
    expect((await userRow(id)).password_hash).toBe(hash)

    await db.execute('UPDATE users SET locked_until = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE user_id = ?', [id])
    expect((await change(cookie, next, wrong)).status).toBe(422)
    expect((await userRow(id)).failed_login_count).toBe(1)
    expect((await change(cookie)).status).toBe(204)
    expect(await userRow(id)).toMatchObject({ failed_login_count: 0, locked_until: null })
  })

  test('ยิงพร้อมกันก็เดาได้ไม่เกินจำนวนครั้ง', async () => {
    const id = await addUser('a@test.local')
    const { cookie } = await login('a@test.local')
    const results = await Promise.all(Array.from({ length: 12 }, () => change(cookie, next, wrong)))

    expect(results.filter(result => result.status === 422)).toHaveLength(4)
    expect(results.filter(result => result.status === 423)).toHaveLength(1)
    expect(results.filter(result => result.status === 401)).toHaveLength(7)
    expect((await userRow(id)).failed_login_count).toBe(5)
  })

  test('สองเครื่องเปลี่ยนพร้อมกัน สำเร็จได้เครื่องเดียว', async () => {
    await addUser('a@test.local')
    const first = await login('a@test.local')
    const second = await login('a@test.local')
    const results = await Promise.all([change(first.cookie, `${next}-1`), change(second.cookie, `${next}-2`)])

    expect(results.map(result => result.status).sort()).toEqual([204, 401])
    expect(await sessionCount()).toBe(1)
  })

  test('ต้องเข้าสู่ระบบ มาจากหน้าเว็บของระบบ และส่งข้อมูลครบ', async () => {
    const id = await addUser('a@test.local')
    const { cookie } = await login('a@test.local')

    for (const bad of [undefined, `${sessionCookie}=not-a-session`]) {
      const result = await change(bad)
      expect(result.status).toBe(401)
      expect(result.body).toEqual({ message: 'กรุณาเข้าสู่ระบบ' })
    }
    const foreign = await call('POST', '/auth/change-password', {
      body: { currentPassword: password, newPassword: next }, cookie, origin: 'https://evil.example',
    })
    expect(foreign.status).toBe(403)
    for (const body of [{}, { newPassword: next }, { currentPassword: '', newPassword: next },
      { currentPassword: password, newPassword: 'x'.repeat(1001) }]) {
      expect((await call('POST', '/auth/change-password', { body, cookie })).status).toBe(422)
    }

    await db.execute('UPDATE users SET is_active = FALSE WHERE user_id = ?', [id])
    expect((await change(cookie)).status).toBe(401)
    await db.execute('UPDATE users SET is_active = TRUE WHERE user_id = ?', [id])
    await db.execute('UPDATE sessions SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND')
    expect((await change(cookie)).status).toBe(401)
    expect(await userRow(id)).toMatchObject({ password_hash: hash, failed_login_count: 0 })
  })
})

describe('การป้องกัน', () => {
  test('คำขอที่แก้ข้อมูลต้องมาจากหน้าเว็บของระบบ', async () => {
    await addUser('a@test.local')
    for (const from of [null, 'https://evil.example', 'http://localhost:3001', 'null']) {
      const result = await call('POST', '/auth/login', { body: { email: 'a@test.local', password, remember: false }, origin: from })
      expect(result.status).toBe(403)
      expect(result.setCookie).toHaveLength(0)
    }
    const { cookie } = await login('a@test.local')
    expect((await call('POST', '/auth/logout', { cookie, origin: 'https://evil.example' })).status).toBe(403)
    expect(await sessionCount()).toBe(1)
  })

  test('จำกัดคำขอ /auth ต่อ IP', async () => {
    app = createApp({ db, config: { ...config, authRateLimit: 3 } })
    const from = (address: string) => call('POST', '/auth/logout', { headers: { 'x-forwarded-for': address } })
    for (let i = 0; i < 3; i++) expect((await from('10.0.0.1')).status).toBe(204)
    const blocked = await from('10.0.0.1')
    expect(blocked.status).toBe(429)
    expect(blocked.body.message).toContain('ส่งคำขอถี่เกินไป')
    expect((await from('10.0.0.2')).status).toBe(204)
    expect((await call('GET', '/me', { headers: { 'x-forwarded-for': '10.0.0.1' } })).status).toBe(401)
  })

  test('เส้นทางที่ไม่มีและข้อผิดพลาดภายในไม่เปิดเผยรายละเอียด', async () => {
    const missing = await call('GET', '/me/dashboard')
    expect(missing.status).toBe(404)
    expect(missing.body).toEqual({ message: 'ไม่พบข้อมูลที่ขอ' })

    const broken = createDatabase('mysql://nobody:nothing@127.0.0.1:1/none_test')
    app = createApp({ db: broken, config })
    const log = console.error
    console.error = () => {}
    try {
      const failed = await login('a@test.local')
      expect(failed.status).toBe(500)
      expect(failed.body).toEqual({ message: 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่' })
    }
    finally {
      console.error = log
      await broken.end()
    }
  })
})
