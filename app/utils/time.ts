/** แปลงเวลา "HH:MM" เป็นจำนวนนาทีนับจากเที่ยงคืน */
export function toMinutes(time: string) {
  const [hours = 0, minutes = 0] = time.split(':').map(value => Number.parseInt(value, 10))
  return hours * 60 + minutes
}

/** รับ "9:00", "09.00" หรือ "09:00 น." คืน "HH:MM" หรือ undefined ถ้าไม่ถูกต้อง */
export function parseClock(text: string) {
  const match = text.trim().match(/^(\d{1,2})[:.](\d{2})\s*(?:น\.?)?$/)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return undefined
  return `${match[1]!.padStart(2, '0')}:${match[2]}`
}

/** เช่น 150 -> "2 ชม. 30 นาที" */
export function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} ชม. ${minutes} นาที` : `${hours} ชม.`
}

/** เวลาแบบ 24 ชั่วโมง "HH:MM" */
export function formatClock(date: Date) {
  return [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':')
}
