import type { Pool, RowDataPacket } from 'mysql2/promise'
import { transaction } from '../database'
import { HttpError } from '../errors'
import { utcToIso } from '../time'
import { profileById } from '../users/profile'
import type { UnknownEmailGuard } from './limits'
import { verifyPassword } from './passwords'
import { createSession } from './sessions'

interface LockSettings extends RowDataPacket {
  max_failed_logins: number
  lock_minutes: number
}

interface AccountRow extends RowDataPacket {
  user_id: number
  password_hash: string | null
  is_active: number
  failed_login_count: number
  locked_until: string | null
  is_locked: number | null
}

const invalidCredentials = () => new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', { code: 'invalid_credentials' })
const accountLocked = (lockedUntil: string) => new HttpError(423, 'บัญชีถูกล็อกชั่วคราว', { code: 'account_locked', lockedUntil })

export async function logIn(
  db: Pool,
  guard: UnknownEmailGuard,
  input: { email: string, password: string, remember: boolean },
) {
  const email = input.email.trim().toLowerCase()
  const [settingRows] = await db.query<LockSettings[]>('SELECT max_failed_logins, lock_minutes FROM system_settings WHERE setting_id = 1')
  const settings = settingRows[0]
  if (!settings) throw new Error('ไม่มีแถวใน system_settings รัน backend/db/schema.sql ก่อน')

  // ข้อผิดพลาดคืนเป็นค่า ไม่โยนใน transaction การนับครั้งที่ผิดจึงถูกบันทึก
  const outcome = await transaction(db, async (connection) => {
    // ล็อกแถวบัญชี คำขอที่ยิงพร้อมกันจึงนับครั้งที่ผิดครบทุกครั้ง
    const [rows] = await connection.execute<AccountRow[]>(
      `SELECT user_id, password_hash, is_active, failed_login_count, locked_until, locked_until > UTC_TIMESTAMP() AS is_locked
         FROM users WHERE email = ? FOR UPDATE`,
      [email],
    )
    const account = rows[0]
    if (!account) return { unknown: true as const }
    if (account.is_locked) return { error: accountLocked(utcToIso(account.locked_until!)) }

    if (!await verifyPassword(input.password, account.password_hash)) {
      // พ้นเวลาล็อกแล้วเริ่มนับใหม่
      const count = (account.locked_until ? 0 : account.failed_login_count) + 1
      const lock = count >= settings.max_failed_logins
      await connection.execute(
        `UPDATE users SET failed_login_count = ?,
                locked_until = IF(?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, NULL), updated_at = updated_at
          WHERE user_id = ?`,
        [Math.min(count, 255), lock, settings.lock_minutes, account.user_id],
      )
      if (!lock) return { error: invalidCredentials() }
      const [locked] = await connection.execute<AccountRow[]>('SELECT locked_until FROM users WHERE user_id = ?', [account.user_id])
      return { error: accountLocked(utcToIso(locked[0]!.locked_until!)) }
    }

    await connection.execute(
      'UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = updated_at WHERE user_id = ?',
      [account.user_id],
    )
    // บอกว่าถูกระงับเฉพาะเมื่อรหัสผ่านถูกต้องแล้ว (ขอบเขตงานข้อ 4.1)
    if (!account.is_active) return { error: new HttpError(403, 'บัญชีถูกระงับ', { code: 'account_suspended' }) }

    await connection.execute(
      'UPDATE users SET last_login_at = UTC_TIMESTAMP(), updated_at = updated_at WHERE user_id = ?',
      [account.user_id],
    )
    const token = await createSession(connection, account.user_id, input.remember)
    return { token, profile: (await profileById(connection, account.user_id))! }
  })

  if ('unknown' in outcome) {
    // ทำนอก transaction ไม่ถือ lock ระหว่างตรวจรหัสหลอก
    await verifyPassword(input.password, null)
    const lockedUntil = guard.fail(email, settings.max_failed_logins, settings.lock_minutes)
    throw lockedUntil ? accountLocked(lockedUntil) : invalidCredentials()
  }
  if ('error' in outcome) throw outcome.error
  return outcome
}
