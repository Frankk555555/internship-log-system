const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** แปลง "วว-ดด-ปปปป" (พ.ศ.) เป็น "YYYY-MM-DD" (ค.ศ.) คืน undefined ถ้าไม่ใช่วันที่จริง */
export function parseThaiDate(text: string) {
  const match = text.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (!match) return undefined

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3]) - 543
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined

  return date.toISOString().slice(0, 10)
}

/** วันที่สำหรับแสดงผล "วว-เดือนย่อ-ปปปป" (พ.ศ.) เช่น "26-พ.ย.-2569" */
export function formatThaiDate(iso: string) {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number)
  return `${String(day).padStart(2, '0')}-${thaiMonths[month - 1]}-${year + 543}`
}

/** วันที่ในช่องกรอก "วว-ดด-ปปปป" (พ.ศ.) เป็นตัวเลขเพื่อให้พิมพ์แก้ได้ */
export function formatThaiInputDate(iso: string) {
  const [year, month, day] = iso.split('-')
  return `${day}-${month}-${Number(year) + 543}`
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** แยกวันเวลา ISO 8601 เป็นวันที่และเวลาตามเขตเวลาไทย */
export function toThaiTimeParts(isoDateTime: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(isoDateTime)).map(part => [part.type, part.value]))

  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** วันจันทร์ของสัปดาห์ (จันทร์–อาทิตย์) ที่มีวันนั้นอยู่ */
export function startOfWeek(iso: string) {
  const daysSinceMonday = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(iso, -daysSinceMonday)
}

/** วันและเดือนสำหรับที่แคบ เช่น "10-ส.ค." */
export function formatThaiDayMonth(iso: string) {
  const [, month = 1, day = 1] = iso.split('-').map(Number)
  return `${String(day).padStart(2, '0')}-${thaiMonths[month - 1]}`
}

/** ช่วงวันที่ เช่น "23-พ.ย.-2569 – 29-พ.ย.-2569" */
export function formatThaiDateRange(from: string, to: string) {
  return from === to ? formatThaiDate(from) : `${formatThaiDate(from)} – ${formatThaiDate(to)}`
}
