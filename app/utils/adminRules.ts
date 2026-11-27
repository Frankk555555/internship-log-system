// ช่วงจำนวนวันที่ตั้งได้ในหน้าตั้งค่าระบบ (backend ต้องตรวจซ้ำ)
// แยกเป็นค่าเดี่ยว: auto-import ของ Nuxt มองไม่เห็นฟังก์ชันที่ต่อจาก export const แบบ object
export const minSettingDays = 1
export const maxSettingDays = 30

export function settingDayError(value: string) {
  const text = value.trim()
  if (!text) return 'กรุณากรอกจำนวนวัน'
  const days = Number(text)
  if (!/^\d+$/.test(text) || days < minSettingDays || days > maxSettingDays) {
    return `กรอกจำนวนเต็ม ${minSettingDays}–${maxSettingDays} วัน`
  }
  return undefined
}
