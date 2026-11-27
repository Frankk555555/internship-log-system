import type { UserRole } from '~/types/worklog'

// ขอบเขตงานไม่ได้กำหนดเงื่อนไขรหัสผ่าน ใช้ขั้นต่ำนี้จนกว่าจะตกลงกัน (backend ต้องตรวจซ้ำ)
export const minPasswordLength = 8

export function newPasswordError(password: string) {
  if (!password) return 'กรุณากรอกรหัสผ่านใหม่'
  if (password.length < minPasswordLength) return `รหัสผ่านต้องมีอย่างน้อย ${minPasswordLength} ตัวอักษร`
  return undefined
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** เช่น "somchai.k@university.ac.th" -> "s***@university.ac.th" */
export function maskEmail(email: string) {
  const [name = '', domain = ''] = email.trim().split('@')
  return `${name.slice(0, 1)}***@${domain}`
}

export const roleLabels: Record<UserRole, string> = {
  student: 'นักศึกษา',
  supervisor: 'พี่เลี้ยง',
  admin: 'แอดมิน',
}

/** หน้าแรกของแต่ละบทบาท (ยังไม่มีหน้าของแอดมิน) */
export function homePathFor(role?: UserRole) {
  if (role === 'supervisor') return '/mentor/reviews'
  if (role === 'admin') return '/settings'
  return '/'
}
