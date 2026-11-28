import type { Pool } from 'mysql2/promise'
import { transaction } from '../database'
import { HttpError } from '../errors'
import { utcToIso } from '../time'
import { profileById } from '../users/profile'
import type { UnknownEmailGuard } from './limits'
import { type LockableAccount, lockColumns, readLockSettings, recordFailure } from './lock'
import { verifyPassword } from './passwords'
import { createSession } from './sessions'

interface AccountRow extends LockableAccount {
  user_id: number
  is_active: number
}

const invalidCredentials = () => new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', { code: 'invalid_credentials' })
const accountLocked = (lockedUntil: string) => new HttpError(423, 'บัญชีถูกล็อกชั่วคราว', { code: 'account_locked', lockedUntil })

export async function logIn(
  db: Pool,
  guard: UnknownEmailGuard,
  input: { email: string, password: string, remember: boolean },
) {
  const email = input.email.trim().toLowerCase()
  const settings = await readLockSettings(db)

  // ข้อผิดพลาดคืนเป็นค่า ไม่โยนใน transaction การนับครั้งที่ผิดจึงถูกบันทึก
  const outcome = await transaction(db, async (connection) => {
    // ล็อกแถวบัญชี คำขอที่ยิงพร้อมกันจึงนับครั้งที่ผิดครบทุกครั้ง
    const [rows] = await connection.execute<AccountRow[]>(
      `SELECT user_id, is_active, ${lockColumns} FROM users WHERE email = ? FOR UPDATE`,
      [email],
    )
    const account = rows[0]
    if (!account) return { unknown: true as const }
    if (account.is_locked) return { error: accountLocked(utcToIso(account.locked_until!)) }

    if (!await verifyPassword(input.password, account.password_hash)) {
      const lockedUntil = await recordFailure(connection, account.user_id, account, settings)
      return { error: lockedUntil ? accountLocked(lockedUntil) : invalidCredentials() }
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
