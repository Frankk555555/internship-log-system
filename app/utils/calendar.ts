import type { ReviewStatus, WorkHours, WorkLog } from '~/types/worklog'
import { formatThaiDayMonth } from './date'
import { toMinutes } from './time'

/** สีและชื่อสถานะการตรวจบนปฏิทิน (ตามภาพออกแบบ) */
export const calendarStatusMeta: Record<ReviewStatus, { label: string, block: string, chip: string, text: string }> = {
  draft: { label: 'ฉบับร่าง', block: 'border-slate-600 bg-slate-100', chip: 'bg-slate-100', text: 'text-slate-600' },
  submitted: { label: 'ส่งตรวจ', block: 'border-amber-700 bg-amber-100', chip: 'bg-amber-100', text: 'text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', block: 'border-green-600 bg-green-100', chip: 'bg-green-100', text: 'text-green-700' },
  returned: { label: 'ส่งกลับ', block: 'border-red-600 bg-red-100', chip: 'bg-red-100', text: 'text-red-600' },
}

const weekdays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const weekdayIndex = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()

/** เช่น "จ. 10 ส.ค." */
export function formatCalendarDay(iso: string) {
  return `${weekdays[weekdayIndex(iso)]} ${formatThaiDayMonth(iso)}`
}

export function isWeekend(iso: string) {
  return [0, 6].includes(weekdayIndex(iso))
}

/** ความสูงขั้นต่ำของช่อง (นาที) ให้อ่านชื่อและเวลาได้ */
const MIN_BLOCK_MINUTES = 45

export interface CalendarBlock {
  log: WorkLog
  /** นาทีนับจากเที่ยงคืน ช่วงที่ใช้วาด อาจยาวกว่าเวลาจริงตามความสูงขั้นต่ำ */
  start: number
  end: number
  /** ตำแหน่งในแนวนอน เมื่อช่องซ้อนกันบนจอ */
  lane: number
  lanes: number
}

/** วางรายการที่มีเวลาเริ่มของวันเดียว runningUntil = ปลายช่องของงานที่กำลังทำ */
export function calendarBlocks(logs: WorkLog[], runningUntil?: number) {
  const blocks: CalendarBlock[] = logs.flatMap((log) => {
    if (!log.startTime) return []
    const start = toMinutes(log.startTime)
    const end = log.endTime ? toMinutes(log.endTime) : runningUntil ?? start
    return [{ log, start, end: Math.max(end, start + MIN_BLOCK_MINUTES), lane: 0, lanes: 1 }]
  }).sort((a, b) => a.start - b.start || a.end - b.end)

  // กลุ่มช่องที่ซ้อนต่อกันแบ่งความกว้างเท่ากัน
  let cluster: CalendarBlock[] = []
  let laneEnds: number[] = []
  const closeCluster = () => {
    for (const block of cluster) block.lanes = laneEnds.length
    cluster = []
    laneEnds = []
  }
  for (const block of blocks) {
    if (laneEnds.every(end => end <= block.start)) closeCluster()
    const free = laneEnds.findIndex(end => end <= block.start)
    block.lane = free < 0 ? laneEnds.length : free
    laneEnds[block.lane] = block.end
    cluster.push(block)
  }
  closeCluster()

  return blocks
}

/** ชั่วโมงแรกและชั่วโมงสุดท้ายของตาราง: เวลางาน (เผื่อ 1 ชม.) ขยายตามรายการที่อยู่นอกช่วง */
export function calendarHourRange(logs: WorkLog[], { workStartTime, workEndTime }: WorkHours) {
  const blocks = calendarBlocks(logs)
  const first = Math.min(toMinutes(workStartTime), ...blocks.map(block => block.start))
  const last = Math.max(toMinutes(workEndTime) + 60, ...blocks.map(block => block.end))
  return { firstHour: Math.floor(first / 60), lastHour: Math.min(24, Math.ceil(last / 60)) }
}

export function calendarTimeLabel(log: WorkLog, today: string) {
  if (log.endTime) return `${log.startTime}–${log.endTime}`
  return log.date === today ? `${log.startTime} · กำลังทำ` : `${log.startTime} · ไม่ได้บันทึกเวลาสิ้นสุด`
}

/** รายการที่แก้ได้เปิดหน้าแก้ไข นอกนั้นเปิดประวัติ */
export function calendarLink(log: WorkLog) {
  return log.canEdit ? `/worklogs/${log.id}/edit` : `/worklogs/${log.id}/history`
}
