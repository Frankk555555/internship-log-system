import type { ReviewStatus, WeeklyReportData } from '~/types/worklog'
import { addDays, formatThaiDate, formatThaiDateRange } from './date'
import { toMinutes } from './time'
import { reviewStatusMeta } from './worklogStatus'
import { createXlsx, type SheetCell } from './xlsx'

export interface ReportRow {
  id: number
  date: string
  title: string
  time: string
  /** ไม่มีค่า ถ้ายังบันทึกเวลาไม่ครบ */
  minutes?: number
  status: ReviewStatus
}

export type WeeklyReport = ReturnType<typeof buildWeeklyReport>

function sumMinutes(rows: ReportRow[]) {
  return rows.reduce((total, row) => total + (row.minutes ?? 0), 0)
}

/** ทศนิยมอย่างน้อย 1 ตำแหน่ง ไม่ปัด 15 นาที (2.25) ให้เป็น 2.3 */
export function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2).replace(/0$/, '')
}

/** เช่น "10-ส.ค.-2569 – 16-ส.ค.-2569" */
export function formatWeekLabel(weekStart: string) {
  return formatThaiDateRange(weekStart, addDays(weekStart, 6))
}

/**
 * สรุปงาน 1 สัปดาห์ (จันทร์–อาทิตย์) ของนักศึกษา 1 คน
 * backend เป็นผู้กรองตามสิทธิ์ (เช่น พี่เลี้ยงไม่เห็นฉบับร่าง) ที่นี่กรองช่วงวันซ้ำและจัดรูปแบบ
 */
export function buildWeeklyReport(data: WeeklyReportData, weekStart: string) {
  const weekEnd = addDays(weekStart, 6)

  const rows: ReportRow[] = data.worklogs
    .filter(log => log.date >= weekStart && log.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
    .map(log => ({
      id: log.id,
      date: formatThaiDate(log.date),
      title: log.title,
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
    totalMinutes: sumMinutes(rows),
    // ชั่วโมงรวมนับเฉพาะรายการที่อนุมัติแล้ว (ขอบเขตงานข้อ 12.3)
    approvedMinutes: sumMinutes(rows.filter(row => row.status === 'approved')),
  }
}

export function downloadWeeklyReportExcel(options: {
  reports: WeeklyReport[]
  weekStart: string
  fileKey: string
  /** เพิ่มบรรทัดชั่วโมงรวมทุกคน */
  showOverallTotal?: boolean
}) {
  const weekLabel = formatWeekLabel(options.weekStart)
  const sheet: SheetCell[][] = []

  for (const report of options.reports) {
    if (sheet.length) sheet.push([])
    sheet.push(
      ['สรุปรายงานประจำสัปดาห์'],
      ['ชื่อนักศึกษา', report.label],
      ['ชื่อพี่เลี้ยง', report.mentorName],
      ['ช่วงวันที่', weekLabel],
      [],
      ['วันที่', 'รายการงาน', 'เวลา', 'ชม.', 'สถานะการตรวจสอบ'],
      ...report.rows.map(row => [row.date, row.title, row.time, row.minutes === undefined ? '–' : row.minutes / 60, reviewStatusMeta[row.status].label]),
    )
    if (!report.rows.length) sheet.push(['ไม่มีรายการงานในสัปดาห์นี้'])
    sheet.push([], ['ชั่วโมงรวม (นับเฉพาะรายการที่อนุมัติแล้ว)', '', '', report.approvedMinutes / 60])
  }

  if (options.showOverallTotal) {
    const overall = options.reports.reduce((total, report) => total + report.approvedMinutes, 0)
    sheet.push([], ['ชั่วโมงรวมทุกคน (นับเฉพาะรายการที่อนุมัติแล้ว)', '', '', overall / 60])
  }

  const url = URL.createObjectURL(createXlsx('รายงานประจำสัปดาห์', sheet, [18, 38, 16, 8, 22]))
  const link = document.createElement('a')
  link.href = url
  link.download = `weekly-report_${options.fileKey}_${options.weekStart}.xlsx`
  link.click()
  // รอให้เบราว์เซอร์เริ่มดาวน์โหลดก่อนคืนหน่วยความจำ
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
