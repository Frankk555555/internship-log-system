// สร้างบัญชีทดสอบในฐานข้อมูลสำหรับพัฒนา รันซ้ำได้ บัญชีที่มีแล้วข้าม
// ชื่อและอีเมลชุดเดียวกับข้อมูลจำลองของหน้าเว็บ (app/services/mockData.ts)
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { hashPassword } from '../src/auth/passwords'
import { readConfig } from '../src/config'
import { createDatabase, transaction } from '../src/database'

const roleIds = { student: 1, supervisor: 2, admin: 3 }

interface SeedAccount {
  email: string
  firstName: string
  lastName: string
  role: keyof typeof roleIds
  studentCode?: string
  /** เข้าครั้งแรก: รหัสผ่านคือรหัสนักศึกษา และต้องตั้งใหม่ */
  firstLogin?: boolean
  suspended?: boolean
}

const accounts: SeedAccount[] = [
  { email: 'somchai.k@university.ac.th', firstName: 'สมชาย', lastName: 'ใจดี', role: 'student', studentCode: '66011233466' },
  { email: 'piyaporn.k@university.ac.th', firstName: 'ปิยะพร', lastName: 'แก้วมณี', role: 'student', studentCode: '66011233471', firstLogin: true },
  { email: 'wichai.p@university.ac.th', firstName: 'วิชัย', lastName: 'พัฒนาการ', role: 'supervisor' },
  { email: 'arunee.s@university.ac.th', firstName: 'อรุณี', lastName: 'ศรีสุข', role: 'admin' },
  { email: 'suspended@university.ac.th', firstName: 'บัญชี', lastName: 'ทดสอบระงับ', role: 'student', studentCode: '66011233499', suspended: true },
]

const config = readConfig()
const { hostname } = new URL(config.databaseUrl)
// กันการสร้างบัญชีทดสอบในฐานข้อมูลของเครื่องอื่น
if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
  throw new Error(`สร้างบัญชีทดสอบได้เฉพาะฐานข้อมูลในเครื่อง (DATABASE_URL ชี้ไปที่ ${hostname})`)
}
const password = process.env.SEED_PASSWORD ?? ''
if (password.length < 8) throw new Error('ตั้ง SEED_PASSWORD อย่างน้อย 8 ตัวอักษรใน backend/.env')

const db = createDatabase(config.databaseUrl)
try {
  for (const account of accounts) {
    const [existing] = await db.execute<RowDataPacket[]>('SELECT 1 FROM users WHERE email = ?', [account.email])
    if (existing.length) {
      console.log('มีอยู่แล้ว', account.email)
      continue
    }
    const hash = await hashPassword(account.firstLogin ? account.studentCode! : password)
    await transaction(db, async (connection) => {
      const [inserted] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (role_id, email, password_hash, first_name, last_name, is_active, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [roleIds[account.role], account.email, hash, account.firstName, account.lastName, !account.suspended, Boolean(account.firstLogin)],
      )
      if (account.studentCode) {
        await connection.execute('INSERT INTO students_detail (user_id, student_code) VALUES (?, ?)', [inserted.insertId, account.studentCode])
      }
    })
    console.log('สร้างแล้ว', account.email, account.role, account.firstLogin ? '(รหัสผ่าน = รหัสนักศึกษา)' : account.suspended ? '(ระงับ)' : '')
  }
}
finally {
  await db.end()
}
