import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
// ชนิดข้อมูลชุดเดียวกับหน้าเว็บ typecheck จะฟ้องเมื่อสองฝั่งไม่ตรงกัน
import type { UserProfile, UserRole } from '../../../app/types/worklog'
import { hashToken } from '../auth/sessions'
import { thaiToday } from '../time'

interface ProfileRow extends RowDataPacket {
  first_name: string
  last_name: string
  email: string
  role_name: UserRole
  must_change_password: number
  student_code: string | null
}

const profileQuery = `
  SELECT u.first_name, u.last_name, u.email, u.must_change_password, r.role_name, s.student_code
    FROM users u
    JOIN roles r ON r.role_id = u.role_id
    LEFT JOIN students_detail s ON s.user_id = u.user_id`

/** อักษรย่อสำหรับรูปแทนตัว ข้ามสระหน้าของภาษาไทย ตรงกับ initialsOf ใน app/utils/auth.ts */
function initialsOf(firstName: string, lastName: string) {
  return [firstName, lastName]
    .map(part => part.trim().replace(/^[เ-ไ]+/, '').charAt(0).toUpperCase())
    .join('')
}

function toProfile(row: ProfileRow): UserProfile {
  return {
    name: `${row.first_name} ${row.last_name}`,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    initials: initialsOf(row.first_name, row.last_name),
    ...(row.student_code ? { studentId: row.student_code } : {}),
    role: row.role_name,
    mustChangePassword: Boolean(row.must_change_password),
    defaultReportDate: thaiToday(),
  }
}

export async function profileById(db: Pool | PoolConnection, userId: number) {
  const [rows] = await db.execute<ProfileRow[]>(`${profileQuery} WHERE u.user_id = ?`, [userId])
  return rows[0] && toProfile(rows[0])
}

/** ผู้ใช้ของ session ที่ยังไม่หมดอายุ บัญชีที่ถูกระงับใช้ session เดิมไม่ได้ทันที */
export async function profileBySession(db: Pool, token: string) {
  const [rows] = await db.execute<ProfileRow[]>(
    `${profileQuery}
      JOIN sessions se ON se.user_id = u.user_id
     WHERE se.token_hash = ? AND se.expires_at > UTC_TIMESTAMP() AND u.is_active`,
    [hashToken(token)],
  )
  return rows[0] && toProfile(rows[0])
}
