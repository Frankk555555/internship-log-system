import type { BadgeTone, ReviewStatus, WorkStatus } from '~/types/worklog'

export const workStatusMeta: Record<WorkStatus, { label: string, tone: BadgeTone }> = {
  pending: { label: 'รอดำเนินการ', tone: 'slate' },
  in_progress: { label: 'กำลังดำเนินการ', tone: 'blue' },
  done: { label: 'เสร็จสิ้น', tone: 'green' },
}

export const reviewStatusMeta: Record<ReviewStatus, { label: string, tone: BadgeTone }> = {
  draft: { label: 'ฉบับร่าง', tone: 'slate' },
  submitted: { label: 'รอตรวจ', tone: 'amber' },
  returned: { label: 'ส่งกลับแก้ไข', tone: 'pink' },
  approved: { label: 'อนุมัติ', tone: 'green' },
}
