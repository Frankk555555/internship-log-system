import type { Pool, RowDataPacket } from 'mysql2/promise'
import { transaction } from '../database'
import { HttpError } from '../errors'
import { type LockableAccount, lockColumns, readLockSettings, recordFailure } from './lock'
import { hashPassword, newPasswordError, verifyPassword } from './passwords'
import { hashToken } from './sessions'

interface SessionRow extends RowDataPacket {
  user_id: number
}

interface StudentRow extends RowDataPacket {
  student_code: string
}

const signedOut = () => new HttpError(401, 'กรุณาเข้าสู่ระบบ')

/**
 * เปลี่ยนรหัสผ่านของผู้ใช้ใน session แล้วตัด session อื่นทั้งหมด
 * กรอกรหัสปัจจุบันผิดนับรวมกับการเข้าสู่ระบบ ครบจำนวนครั้งแล้วล็อกบัญชีและออกจากระบบทุกเครื่อง
 */
export async function changePassword(db: Pool, token: string, input: { currentPassword: string, newPassword: string }) {
  const tokenHash = hashToken(token)
  const sessionQuery = `
    SELECT se.user_id FROM sessions se JOIN users u ON u.user_id = se.user_id
     WHERE se.token_hash = ? AND se.expires_at > UTC_TIMESTAMP() AND u.is_active`
  const [found] = await db.execute<SessionRow[]>(sessionQuery, [tokenHash])
  if (!found[0]) throw signedOut()
  const userId = found[0].user_id
  const settings = await readLockSettings(db)

  // ข้อผิดพลาดคืนเป็นค่า ไม่โยนใน transaction การนับครั้งที่ผิดจึงถูกบันทึก
  const failure = await transaction(db, async (connection) => {
    // คำสั่งแรกต้องล็อกแถวบัญชี การอ่านหลังจากนี้จึงเห็นผลของคำขอที่ทำเสร็จก่อนหน้า
    const [rows] = await connection.execute<LockableAccount[]>(
      `SELECT ${lockColumns} FROM users WHERE user_id = ? FOR UPDATE`,
      [userId],
    )
    const account = rows[0]
    // ระหว่างรอ lock อาจถูกออกจากระบบหรือระงับบัญชีไปแล้ว
    const [still] = await connection.execute<SessionRow[]>(sessionQuery, [tokenHash])
    if (!account || !still[0]) return signedOut()
    // ถูกล็อกจากการกรอกผิดที่หน้าเข้าสู่ระบบ ห้ามใช้หน้านี้เดารหัสต่อ session เดิมยังใช้ได้
    if (account.is_locked) return new HttpError(423, 'บัญชีถูกล็อกชั่วคราว จึงยังเปลี่ยนรหัสผ่านไม่ได้ กรุณาลองใหม่ภายหลัง')

    if (!await verifyPassword(input.currentPassword, account.password_hash)) {
      const lockedUntil = await recordFailure(connection, userId, account, settings)
      if (!lockedUntil) return new HttpError(422, 'รหัสผ่านปัจจุบันไม่ถูกต้อง', { code: 'wrong_password' })
      await connection.execute('DELETE FROM sessions WHERE user_id = ?', [userId])
      return new HttpError(423, 'บัญชีถูกล็อกชั่วคราว', { code: 'account_locked', lockedUntil })
    }

    // รหัสปัจจุบันถูกแล้ว เริ่มนับครั้งที่ผิดใหม่ แม้รหัสใหม่จะยังใช้ไม่ได้
    await connection.execute(
      'UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = updated_at WHERE user_id = ?',
      [userId],
    )
    const [students] = await connection.execute<StudentRow[]>('SELECT student_code FROM students_detail WHERE user_id = ?', [userId])
    const problem = newPasswordError(input.newPassword, students[0]?.student_code)
      ?? (input.newPassword === input.currentPassword ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' : undefined)
    if (problem) return new HttpError(422, problem)

    await connection.execute(
      'UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE user_id = ?',
      [await hashPassword(input.newPassword), userId],
    )
    await connection.execute('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, tokenHash])
    // ลิงก์ตั้งรหัสผ่านที่ออกไว้ก่อนหน้าใช้ไม่ได้อีก
    await connection.execute(
      'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL',
      [userId],
    )
    return undefined
  })

  if (failure) throw failure
}
