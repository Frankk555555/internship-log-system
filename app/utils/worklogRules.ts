// กฎการบันทึกเวลา ใช้ร่วมกันระหว่างหน้าจอและข้อมูลจำลอง (backend ต้องบังคับซ้ำ)
import type { WorkHours, WorkLog } from '~/types/worklog'
import { toMinutes } from './time'

/** เลยเวลาเลิกงานแล้ว (เวลาเลิกงานพอดียังบันทึกเสร็จได้) */
export function isAfterWork(time: string, workEndTime: string) {
  return toMinutes(time) > toMinutes(workEndTime)
}

/** งานต้องมีระยะเวลาอย่างน้อย 1 นาที และเสร็จภายในเวลางานของวันเดียวกัน */
export function timeRangeError(startTime: string, endTime: string, { workEndTime }: WorkHours) {
  if (toMinutes(endTime) <= toMinutes(startTime)) return 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม (อย่างน้อย 1 นาที)'
  if (toMinutes(endTime) > toMinutes(workEndTime)) {
    return `เวลาสิ้นสุดต้องไม่เกินเวลาเลิกงาน ${workEndTime} น. งานที่ยังไม่เสร็จให้บันทึกเป็นงานของวันถัดไป`
  }
  return undefined
}

/** เวลาเริ่มของรายการต้องอยู่ในเวลางาน */
export function startTimeError(startTime: string, { workStartTime, workEndTime }: WorkHours) {
  const minutes = toMinutes(startTime)
  if (minutes >= toMinutes(workStartTime) && minutes < toMinutes(workEndTime)) return undefined
  return `เวลาเริ่มต้องอยู่ในเวลางาน ${workStartTime}–${workEndTime} น.`
}

/** เริ่มจับเวลาได้เฉพาะในเวลางาน ข้อความต้องบอกทางไปต่อ */
export function timerStartError(now: string, { workStartTime, workEndTime }: WorkHours) {
  if (toMinutes(now) < toMinutes(workStartTime)) return `ยังไม่ถึงเวลาเข้างาน ${workStartTime} น. กรุณาเริ่มงานเมื่อถึงเวลา`
  if (toMinutes(now) < toMinutes(workEndTime)) return undefined
  return `เลยเวลาเลิกงาน ${workEndTime} น. แล้ว จับเวลาไม่ได้ ถ้าเป็นงานที่ทำวันนี้ ให้กรอกเวลาที่ทำจริงเอง`
}

/** บันทึกได้เฉพาะงานที่ทำแล้ว เวลาของวันนี้ต้องไม่เกินเวลาปัจจุบัน */
export function futureTimeError(date: string, time: string, now: { date: string, time: string }) {
  if (date !== now.date || toMinutes(time) <= toMinutes(now.time)) return undefined
  return 'เวลายังมาไม่ถึง กรอกได้เฉพาะงานที่ทำแล้ว'
}

/** กดเสร็จหลังเลิกงานไม่ได้ ต้องกรอกเวลาที่ทำเสร็จจริงแทน */
export function timerFinishError(now: string, { workEndTime }: WorkHours) {
  if (!isAfterWork(now, workEndTime)) return undefined
  return `เลยเวลาเลิกงาน ${workEndTime} น. แล้ว กรุณากรอกเวลาที่ทำเสร็จจริงในหน้าแก้ไขรายการ`
}

/**
 * รายการในวันเดียวกันที่เวลาซ้อนทับ (ขอบเขตงานข้อ 5.7) ถ้าซ้อนทับห้ามบันทึก
 * ไม่มี endTime = ตรวจเฉพาะว่าเวลาเริ่มอยู่ในช่วงของรายการอื่นหรือไม่
 */
export function findOverlaps(logs: WorkLog[], startTime: string, endTime?: string, excludeId?: number) {
  const from = toMinutes(startTime)
  const to = endTime ? toMinutes(endTime) : from + 1

  return logs.filter(log => log.id !== excludeId && log.startTime && log.endTime
    && from < toMinutes(log.endTime) && toMinutes(log.startTime) < to)
}

/**
 * ช่องวันที่และเวลาที่นักศึกษาพิมพ์แก้เองได้ กันการเพิ่มชั่วโมงย้อนหลัง (backend ต้องบังคับซ้ำ)
 * - ถูกส่งกลับ: ล็อก เว้นแต่พี่เลี้ยงเปิดให้แก้
 * - ระบบจับเวลา: ล็อก เว้นแต่ลืมกดเสร็จสิ้นจนเลยเวลาเลิกงานหรือข้ามวัน กรอกเวลาสิ้นสุดเองได้ครั้งเดียว
 * - กรอกเอง (บันทึกย้อนหลังหรือยังไม่มีเวลา): แก้ได้
 */
export function timePolicy(log: WorkLog | undefined, today: string, afterWork = false) {
  const editable = { date: true, start: true, end: true }
  const locked = { date: false, start: false, end: false }

  if (!log) return editable
  if (log.reviewStatus === 'returned') return log.timeEditAllowed ? editable : locked
  if (log.timeSource === 'timer_manual_end') return locked
  if (log.timeSource !== 'timer') return editable
  return { ...locked, end: !log.endTime && (log.date < today || (log.date === today && afterWork)) }
}

export function overlapMessage(log: WorkLog) {
  return `เวลาซ้อนทับกับรายการ “${log.title}” (${log.startTime}–${log.endTime} น.)`
}
