import type { BadgeTone, ReviewStatus, WorkStatus } from '~/types/worklog'

// ชื่อและสีสถานะตาม docs/design-pattern.md ข้อ 4 ใช้ชุดเดียวกันทุกหน้า
export const workStatusMeta: Record<WorkStatus, { label: string, tone: BadgeTone }> = {
  pending: { label: 'รอดำเนินการ', tone: 'slate' },
  in_progress: { label: 'กำลังดำเนินการ', tone: 'blue' },
  done: { label: 'เสร็จสิ้น', tone: 'green' },
}

export const reviewStatusMeta: Record<ReviewStatus, { label: string, tone: BadgeTone }> = {
  draft: { label: 'ฉบับร่าง', tone: 'draft' },
  submitted: { label: 'รอตรวจ', tone: 'amber' },
  returned: { label: 'ส่งกลับแก้ไข', tone: 'rose' },
  approved: { label: 'อนุมัติแล้ว', tone: 'green' },
}
