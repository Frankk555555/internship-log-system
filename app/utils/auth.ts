import type { UserRole } from '~/types/worklog'

// กติกาตาม docs/business-rules.md backend ตรวจซ้ำใน backend/src/auth/passwords.ts
export const minPasswordLength = 8
export const maxPasswordLength = 128

/** studentId: นักศึกษาห้ามตั้งรหัสผ่านเป็นรหัสนักศึกษา ซึ่งเป็นรหัสเริ่มต้นและคนอื่นรู้ได้ */
export function newPasswordError(password: string, studentId?: string) {
  if (!password) return 'กรุณากรอกรหัสผ่านใหม่'
  if (password.length < minPasswordLength) return `รหัสผ่านต้องมีอย่างน้อย ${minPasswordLength} ตัวอักษร`
  if (password.length > maxPasswordLength) return `รหัสผ่านยาวได้ไม่เกิน ${maxPasswordLength} ตัวอักษร`
  if (studentId && password === studentId) return 'รหัสผ่านใหม่ต้องไม่ใช่รหัสนักศึกษา'
  return undefined
}

export const firstPasswordPath = '/first-password'

/** รับเฉพาะเส้นทางภายในเว็บ กันการพาไปเว็บอื่น */
export function safeRedirect(target: unknown) {
  return typeof target === 'string' && /^\/(?![/\\])/.test(target) ? target : undefined
}

// ขอบเขตงานไม่ได้กำหนดความยาวชื่อ ใช้ค่านี้จนกว่าจะตกลงกัน (backend ต้องตรวจซ้ำ)
export const maxNameLength = 50

export function nameError(value: string, label: 'ชื่อ' | 'นามสกุล') {
  if (!value.trim()) return `กรุณากรอก${label}`
  if (value.trim().length > maxNameLength) return `${label}ยาวได้ไม่เกิน ${maxNameLength} ตัวอักษร`
  return undefined
}

/** อักษรย่อสำหรับรูปแทนตัว ข้ามสระหน้าของภาษาไทย เช่น "เอก ใจดี" -> "อจ" */
export function initialsOf(firstName: string, lastName: string) {
  return [firstName, lastName]
    .map(part => part.trim().replace(/^[เ-ไ]+/, '').charAt(0).toUpperCase())
    .join('')
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

/** หน้าแรกของแต่ละบทบาท */
export function homePathFor(role?: UserRole) {
  if (role === 'supervisor') return '/mentor/reviews'
  if (role === 'admin') return '/admin'
  return '/'
}

/** layout ของหน้าที่หลายบทบาทใช้ร่วมกัน */
export function layoutFor(role?: UserRole): 'staff' | 'default' {
  return role === 'supervisor' || role === 'admin' ? 'staff' : 'default'
}
