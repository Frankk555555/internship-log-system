import type { InternshipInput, UserInput } from '~/types/admin'
import { isEmail, nameError } from '~/utils/auth'
import { toMinutes } from '~/utils/time'

// ช่วงจำนวนวันที่ตั้งได้ในหน้าตั้งค่าระบบ (backend ต้องตรวจซ้ำ)
// แยกเป็นค่าเดี่ยว: auto-import ของ Nuxt มองไม่เห็นฟังก์ชันที่ต่อจาก export const แบบ object
export const minSettingDays = 1
export const maxSettingDays = 30

// ขีดจำกัดของไฟล์นำเข้าผู้ใช้ (backend ต้องตรวจซ้ำ)
export const maxImportMegabytes = 2
export const maxImportRows = 500

export function importFileError({ name, size }: { name: string, size: number }) {
  if (!name.toLowerCase().endsWith('.xlsx')) return 'รองรับเฉพาะไฟล์ .xlsx'
  if (size > maxImportMegabytes * 1024 * 1024) return `ไฟล์ต้องไม่เกิน ${maxImportMegabytes} MB`
  return undefined
}

/** ขอบเขตงานไม่ได้กำหนดรูปแบบรหัสนักศึกษา ใช้เงื่อนไขนี้จนกว่าจะตกลงกัน (backend ต้องตรวจซ้ำ) */
export function studentIdError(value: string) {
  const text = value.trim()
  if (!text) return 'กรุณากรอกรหัสนักศึกษา'
  if (!/^\d{8,20}$/.test(text)) return 'รหัสนักศึกษาเป็นตัวเลข 8–20 หลัก'
  return undefined
}

function emailError(value: string) {
  if (!value.trim()) return 'กรุณากรอกอีเมล'
  if (!isEmail(value)) return 'รูปแบบอีเมลไม่ถูกต้อง'
  return undefined
}

/** ข้อความผิดพลาดรายช่องของฟอร์มผู้ใช้ ช่องที่ถูกต้องไม่มีค่า */
export function userInputErrors(input: UserInput) {
  return {
    firstName: nameError(input.firstName, 'ชื่อ'),
    lastName: nameError(input.lastName, 'นามสกุล'),
    email: emailError(input.email),
    studentId: input.role === 'student' ? studentIdError(input.studentId ?? '') : undefined,
  }
}

/** ข้อความผิดพลาดรายช่องของข้อมูลฝึกงาน วันที่เป็น YYYY-MM-DD เวลาเป็น HH:MM ช่องที่ยังไม่มีค่าส่งสตริงว่าง */
export function internshipErrors({ company, position, startDate, endDate, workStartTime, workEndTime, mentorId }: Omit<InternshipInput, 'mentorId'> & { mentorId?: number }) {
  return {
    company: company.trim() ? undefined : 'กรุณากรอกหน่วยงาน',
    position: position.trim() ? undefined : 'กรุณากรอกตำแหน่ง',
    startDate: startDate ? undefined : 'กรุณากรอกวันเริ่มฝึกงาน',
    endDate: !endDate ? 'กรุณากรอกวันสิ้นสุด' : startDate && endDate <= startDate ? 'วันสิ้นสุดต้องหลังวันเริ่มฝึกงาน' : undefined,
    workStartTime: workStartTime ? undefined : 'กรุณากรอกเวลาเข้างาน',
    workEndTime: !workEndTime
      ? 'กรุณากรอกเวลาเลิกงาน'
      : workStartTime && toMinutes(workEndTime) <= toMinutes(workStartTime) ? 'เวลาเลิกงานต้องหลังเวลาเข้างาน' : undefined,
    mentorId: mentorId ? undefined : 'กรุณาเลือกพี่เลี้ยง',
  }
}

/** วันที่เป็น YYYY-MM-DD เวลาเป็น HH:MM ช่องที่ยังไม่มีค่าส่งสตริงว่าง */
export function absenceErrors({ mentorId, startDate, startTime, endDate, endTime, reason }: { mentorId?: number, startDate: string, startTime: string, endDate: string, endTime: string, reason: string }) {
  const complete = startDate && startTime && endDate && endTime
  return {
    mentorId: mentorId ? undefined : 'กรุณาเลือกพี่เลี้ยง',
    startDate: startDate ? undefined : 'กรุณากรอกวันที่เริ่ม',
    startTime: startTime ? undefined : 'กรุณากรอกเวลาเริ่ม',
    endDate: endDate ? undefined : 'กรุณากรอกวันที่สิ้นสุด',
    endTime: !endTime
      ? 'กรุณากรอกเวลาสิ้นสุด'
      : complete && `${endDate}T${endTime}` <= `${startDate}T${startTime}` ? 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' : undefined,
    reason: reason.trim() ? undefined : 'กรุณาระบุเหตุผล',
  }
}

export function settingDayError(value: string) {
  const text = value.trim()
  if (!text) return 'กรุณากรอกจำนวนวัน'
  const days = Number(text)
  if (!/^\d+$/.test(text) || days < minSettingDays || days > maxSettingDays) {
    return `กรอกจำนวนเต็ม ${minSettingDays}–${maxSettingDays} วัน`
  }
  return undefined
}
