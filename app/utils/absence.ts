import type { MentorAway } from '~/types/worklog'

/** ข้อความที่นักศึกษาเห็นเมื่อพี่เลี้ยงไม่อยู่หรือไม่สะดวกตรวจงาน */
export function mentorAwayLabel({ type, startTime, endTime, allDay }: MentorAway) {
  return {
    title: type === 'absent' ? 'พี่เลี้ยงไม่อยู่' : 'พี่เลี้ยงไม่สะดวกตรวจงาน',
    time: allDay ? 'ทั้งวัน' : `${startTime}–${endTime} น.`,
  }
}
