// กฎการบันทึกเวลา ใช้ร่วมกันระหว่างหน้าจอและข้อมูลจำลอง (backend ต้องบังคับซ้ำ)
import type { WorkLog } from '~/types/worklog'
import { toMinutes } from './time'

/** งานต้องมีระยะเวลาอย่างน้อย 1 นาที และเสร็จภายในเวลางานของวันเดียวกัน */
export function timeRangeError(startTime: string, endTime: string, workEndTime: string) {
  if (toMinutes(endTime) <= toMinutes(startTime)) return 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม (อย่างน้อย 1 นาที)'
  if (toMinutes(endTime) > toMinutes(workEndTime)) {
    return `เวลาสิ้นสุดต้องไม่เกินเวลาเลิกงาน ${workEndTime} น. งานที่ยังไม่เสร็จให้บันทึกเป็นงานของวันถัดไป`
  }
  return undefined
}

export function startTimeError(startTime: string, workEndTime: string) {
  if (toMinutes(startTime) < toMinutes(workEndTime)) return undefined
  return `เลยเวลาเลิกงาน ${workEndTime} น. แล้ว ให้บันทึกเป็นงานของวันถัดไป`
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

export function overlapMessage(log: WorkLog) {
  return `เวลาซ้อนทับกับรายการ “${log.title}” (${log.startTime}–${log.endTime} น.)`
}
