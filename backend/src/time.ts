/** ประเทศไทยใช้ UTC+7 ตลอดปี */
const thaiOffsetMs = 7 * 60 * 60 * 1000

/** วันที่ของวันนี้ตามเวลาไทย "YYYY-MM-DD" */
export function thaiToday(now = new Date()) {
  return new Date(now.getTime() + thaiOffsetMs).toISOString().slice(0, 10)
}

/** ค่า DATETIME จากฐานข้อมูล (UTC) เป็น ISO 8601 */
export function utcToIso(value: string) {
  return `${value.replace(' ', 'T')}Z`
}
