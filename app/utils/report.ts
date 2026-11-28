import type { ReportData, ReviewStatus } from '~/types/worklog'
import { addDays, formatThaiDate, formatThaiDateRange, startOfWeek } from './date'
import { toMinutes } from './time'
import { reviewStatusMeta } from './worklogStatus'
import { createXlsx, type SheetCell } from './xlsx'

export type ReportView = 'day' | 'week' | 'year'

export interface ReportRow {
  id: number
  /** "YYYY-MM-DD" ใช้จัดกลุ่มตามเดือน */
  isoDate: string
  date: string
  title: string
  description: string
  time: string
  /** ไม่มีค่า ถ้ายังบันทึกเวลาไม่ครบ */
  minutes?: number
  status: ReviewStatus
}

export type ReportPeriod = ReturnType<typeof reportPeriod>

export type Report = ReturnType<typeof buildReport>

function sumMinutes(rows: ReportRow[]) {
  return rows.reduce((total, row) => total + (row.minutes ?? 0), 0)
}

/** ชั่วโมงรวมนับเฉพาะรายการที่อนุมัติแล้ว (ขอบเขตงานข้อ 12.3) */
const approvedOf = (rows: ReportRow[]) => sumMinutes(rows.filter(row => row.status === 'approved'))

/** ทศนิยมอย่างน้อย 1 ตำแหน่ง ไม่ปัด 15 นาที (2.25) ให้เป็น 2.3 */
export function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2).replace(/0$/, '')
}

/** เช่น "10-ส.ค.-2569 – 16-ส.ค.-2569" */
export function formatWeekLabel(weekStart: string) {
  return formatThaiDateRange(weekStart, addDays(weekStart, 6))
}

/** ช่วงวันของรายงานที่มีวันนั้นอยู่: วันเดียว สัปดาห์จันทร์–อาทิตย์ หรือทั้งปีปฏิทิน */
export function reportPeriod(view: ReportView, date: string) {
  if (view === 'day') {
    return { view, from: date, to: date, name: 'รายงานประจำวัน', rangeTitle: 'วันที่', label: formatThaiDate(date), empty: 'ไม่มีรายการงานในวันนี้' }
  }
  if (view === 'week') {
    const from = startOfWeek(date)
    return { view, from, to: addDays(from, 6), name: 'รายงานประจำสัปดาห์', rangeTitle: 'ช่วงวันที่', label: formatWeekLabel(from), empty: 'ไม่มีรายการงานในสัปดาห์นี้' }
  }
  const year = date.slice(0, 4)
  return { view, from: `${year}-01-01`, to: `${year}-12-31`, name: 'รายงานประจำปี', rangeTitle: 'ปี', label: `พ.ศ. ${Number(year) + 543}`, empty: 'ไม่มีรายการงานในปีนี้' }
}

/** เลื่อนไปวัน สัปดาห์ หรือปีก่อนหน้าและถัดไป */
export function shiftReportDate(view: ReportView, date: string, step: number) {
  if (view !== 'year') return addDays(date, step * (view === 'week' ? 7 : 1))
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  // 29 ก.พ. ของปีที่ไม่มีวันนี้ ใช้ 28 ก.พ.
  const lastDay = new Date(Date.UTC(year + step, month, 0)).getUTCDate()
  return new Date(Date.UTC(year + step, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

/** สรุปรายเดือนของรายงานประจำปี ครบ 12 เดือน */
function monthlySummary(rows: ReportRow[], year: string) {
  const monthName = new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, '0')}`
    const inMonth = rows.filter(row => row.isoDate.startsWith(prefix))
    return {
      month: monthName.format(new Date(Date.UTC(Number(year), index, 1))),
      count: inMonth.length,
      totalMinutes: sumMinutes(inMonth),
      approvedMinutes: approvedOf(inMonth),
    }
  })
}

/**
 * รายงานของนักศึกษา 1 คนในช่วงที่เลือก
 * backend เป็นผู้กรองตามสิทธิ์ (เช่น พี่เลี้ยงไม่เห็นฉบับร่าง) ที่นี่กรองช่วงวันซ้ำและจัดรูปแบบ
 */
export function buildReport(data: ReportData, period: ReportPeriod) {
  const rows: ReportRow[] = data.worklogs
    .filter(log => log.date >= period.from && log.date <= period.to)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
    .map(log => ({
      id: log.id,
      isoDate: log.date,
      date: formatThaiDate(log.date),
      title: log.title,
      description: log.description ?? '',
      time: log.startTime ? `${log.startTime}–${log.endTime ?? ''}` : 'ยังไม่เริ่ม',
      minutes: log.startTime && log.endTime ? toMinutes(log.endTime) - toMinutes(log.startTime) : undefined,
      status: log.reviewStatus,
    }))

  return {
    studentId: data.studentId,
    name: data.name,
    mentorName: data.mentorName,
    label: `${data.name} (${data.studentId})`,
    rows,
    months: period.view === 'year' ? monthlySummary(rows, period.from.slice(0, 4)) : [],
    totalMinutes: sumMinutes(rows),
    approvedMinutes: approvedOf(rows),
  }
}

export function downloadReportExcel(options: {
  reports: Report[]
  period: ReportPeriod
  fileKey: string
  /** เพิ่มบรรทัดชั่วโมงรวมทุกคน */
  showOverallTotal?: boolean
}) {
  const { period } = options
  // รายงานประจำวันมีรายละเอียดงานด้วย
  const detailed = period.view === 'day'
  const heading = ['วันที่', 'รายการงาน', ...(detailed ? ['รายละเอียด'] : []), 'เวลา', 'ชม.', 'สถานะการตรวจสอบ']
  const hoursColumn = heading.indexOf('ชม.')
  const total = (label: string, minutes: number): SheetCell[] => [label, ...Array<string>(hoursColumn - 1).fill(''), minutes / 60]
  const sheet: SheetCell[][] = []

  for (const report of options.reports) {
    if (sheet.length) sheet.push([])
    sheet.push(
      [`สรุป${period.name}`],
      ['ชื่อนักศึกษา', report.label],
      ['ชื่อพี่เลี้ยง', report.mentorName],
      [period.rangeTitle, period.label],
      [],
    )
    if (period.view === 'year') {
      sheet.push(
        ['เดือน', 'จำนวนรายการ', 'ชม. ทั้งหมด', 'ชม. ที่อนุมัติ'],
        ...report.months.map(month => [month.month, month.count, month.totalMinutes / 60, month.approvedMinutes / 60]),
        ['รวมทั้งปี', report.rows.length, report.totalMinutes / 60, report.approvedMinutes / 60],
        [],
      )
    }
    sheet.push(heading, ...report.rows.map(row => [
      row.date,
      row.title,
      ...(detailed ? [row.description] : []),
      row.time,
      row.minutes === undefined ? '–' : row.minutes / 60,
      reviewStatusMeta[row.status].label,
    ]))
    if (!report.rows.length) sheet.push([period.empty])
    sheet.push([], total('ชั่วโมงรวม (นับเฉพาะรายการที่อนุมัติแล้ว)', report.approvedMinutes))
  }

  if (options.showOverallTotal) {
    const overall = options.reports.reduce((sum, report) => sum + report.approvedMinutes, 0)
    sheet.push([], total('ชั่วโมงรวมทุกคน (นับเฉพาะรายการที่อนุมัติแล้ว)', overall))
  }

  const file = { day: 'daily', week: 'weekly', year: 'yearly' }[period.view]
  const suffix = period.view === 'year' ? String(Number(period.from.slice(0, 4)) + 543) : period.from
  const url = URL.createObjectURL(createXlsx(period.name, sheet, detailed ? [18, 32, 44, 16, 8, 22] : [18, 38, 16, 14, 22]))
  const link = document.createElement('a')
  link.href = url
  link.download = `${file}-report_${options.fileKey}_${suffix}.xlsx`
  link.click()
  // รอให้เบราว์เซอร์เริ่มดาวน์โหลดก่อนคืนหน่วยความจำ
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
