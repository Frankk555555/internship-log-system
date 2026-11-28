// การล็อกบัญชีเมื่อกรอกรหัสผ่านผิด (ขอบเขตงานข้อ 1.2) ใช้ร่วมกันทั้งตอนเข้าสู่ระบบและเปลี่ยนรหัสผ่าน
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { utcToIso } from '../time'

export interface LockSettings extends RowDataPacket {
  max_failed_logins: number
  lock_minutes: number
}

/** คอลัมน์ของ users ที่ต้องอ่านด้วย FOR UPDATE ก่อนตรวจรหัสผ่าน */
export const lockColumns = 'password_hash, failed_login_count, locked_until, locked_until > UTC_TIMESTAMP() AS is_locked'

export interface LockableAccount extends RowDataPacket {
  password_hash: string | null
  failed_login_count: number
  locked_until: string | null
  is_locked: number | null
}

export async function readLockSettings(db: Pool) {
  const [rows] = await db.query<LockSettings[]>('SELECT max_failed_logins, lock_minutes FROM system_settings WHERE setting_id = 1')
  if (!rows[0]) throw new Error('ไม่มีแถวใน system_settings รัน backend/db/schema.sql ก่อน')
  return rows[0]
}

/**
 * บันทึกการกรอกผิดหนึ่งครั้งของบัญชีที่ล็อกแถวไว้แล้วและไม่ได้ถูกล็อกอยู่
 * คืนเวลาปลดล็อก (ISO 8601) เมื่อครบจำนวนครั้ง
 */
export async function recordFailure(connection: PoolConnection, userId: number, account: LockableAccount, settings: LockSettings) {
  // พ้นเวลาล็อกแล้วเริ่มนับใหม่
  const count = (account.locked_until ? 0 : account.failed_login_count) + 1
  const lock = count >= settings.max_failed_logins
  await connection.execute(
    `UPDATE users SET failed_login_count = ?,
            locked_until = IF(?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, NULL), updated_at = updated_at
      WHERE user_id = ?`,
    [Math.min(count, 255), lock, settings.lock_minutes, userId],
  )
  if (!lock) return undefined
  const [rows] = await connection.execute<LockableAccount[]>('SELECT locked_until FROM users WHERE user_id = ?', [userId])
  return utcToIso(rows[0]!.locked_until!)
}
