// session อยู่ในตาราง sessions cookie เก็บค่าสุ่ม ฐานข้อมูลเก็บเฉพาะ SHA-256 ของค่านั้น
import type { Pool, PoolConnection } from 'mysql2/promise'

export const sessionCookie = 'ils_session'

/** ติ๊กจดจำการเข้าสู่ระบบ */
export const rememberSeconds = 7 * 24 * 60 * 60
/** ไม่ติ๊กจดจำ: cookie หายเมื่อปิดเบราว์เซอร์ และเซิร์ฟเวอร์ตัดเองเมื่อครบเวลานี้นับจากเข้าสู่ระบบ */
export const browserSessionSeconds = 12 * 60 * 60

export function hashToken(token: string) {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex')
}

export async function createSession(connection: PoolConnection, userId: number, remember: boolean) {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  await connection.execute('DELETE FROM sessions WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP()', [userId])
  await connection.execute(
    'INSERT INTO sessions (user_id, token_hash, remember, expires_at) VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? SECOND)',
    [userId, hashToken(token), remember, remember ? rememberSeconds : browserSessionSeconds],
  )
  return token
}

export async function deleteSession(db: Pool, token: string) {
  await db.execute('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)])
}
