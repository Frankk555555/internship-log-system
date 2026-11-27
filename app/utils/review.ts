import type { ReviewItem } from '~/types/review'
import { toMinutes } from './time'

/** ระยะเวลาของรายการที่ส่งตรวจ หน่วยเป็นนาที */
export function reviewMinutes({ worklog }: ReviewItem) {
  return worklog.startTime && worklog.endTime ? toMinutes(worklog.endTime) - toMinutes(worklog.startTime) : 0
}
