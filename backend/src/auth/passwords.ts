export const minPasswordLength = 8
/** จำกัดความยาว กันการส่งข้อความยาวมากให้เซิร์ฟเวอร์ hash */
export const maxPasswordLength = 128

/** กติการหัสผ่านใหม่ (docs/business-rules.md) ตรงกับ newPasswordError ใน app/utils/auth.ts */
export function newPasswordError(password: string, studentCode?: string) {
  if (!password) return 'กรุณากรอกรหัสผ่านใหม่'
  if (password.length < minPasswordLength) return `รหัสผ่านต้องมีอย่างน้อย ${minPasswordLength} ตัวอักษร`
  if (password.length > maxPasswordLength) return `รหัสผ่านยาวได้ไม่เกิน ${maxPasswordLength} ตัวอักษร`
  if (studentCode && password === studentCode) return 'รหัสผ่านใหม่ต้องไม่ใช่รหัสนักศึกษา'
  return undefined
}

// รหัสผ่านเก็บเป็น hash แบบ argon2id (ค่าเริ่มต้นของ Bun)
export function hashPassword(password: string) {
  return Bun.password.hash(password)
}

let placeholder: Promise<string> | undefined

/**
 * hash เป็น null = ไม่มีบัญชีหรือยังไม่ตั้งรหัสผ่าน ตรวจกับค่าหลอกแล้วตอบว่าไม่ผ่าน
 * ให้ใช้เวลาใกล้เคียงกับการตรวจจริง จะได้เดาจากเวลาตอบไม่ได้ว่ามีบัญชีหรือไม่
 */
export async function verifyPassword(password: string, hash: string | null) {
  if (hash) return Bun.password.verify(password, hash)
  placeholder ??= hashPassword(crypto.randomUUID())
  await Bun.password.verify(password, await placeholder)
  return false
}
