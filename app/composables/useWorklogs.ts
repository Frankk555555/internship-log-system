import type { InternshipInfo, UserProfile, WorkLog } from '~/types/worklog'

export function useWorklogs() {
  const user: UserProfile = {
    name: 'สมชาย ใจดี',
    studentId: '66011233466',
    role: 'student',
  }

  const internship: InternshipInfo = {
    company: 'บริษัท เทคคอร์ป ประเทศไทย จำกัด',
    progress: 68,
    startDate: '01-09-2569',
    endDate: '25-12-2569',
  }

  const worklogs: WorkLog[] = [
    {
      id: 1,
      date: '23-11-2569',
      title: 'เชื่อมต่อ API ระบบอัปโหลดไฟล์หลักฐานแบบ',
      description: 'สร้างรายการไร้ส่วนหน้า • ยังไม่ทดลองทำงาน',
      workStatus: 'not_started',
      reviewStatus: 'draft',
    },
    {
      id: 2,
      date: '23-11-2569',
      title: 'พัฒนาหน้าจอ Dashboard พอร์ทัลนักศึกษาด้วย Nuxt.js',
      description: 'กำลังดำเนินการ... ต้องทำงานเสร็จสิ้นก่อนจึงจะส่งตรวจได้',
      startTime: '08:45 น.',
      workStatus: 'in_progress',
      reviewStatus: 'draft',
    },
    {
      id: 3,
      date: '22-11-2569',
      title: 'ออกแบบโครงสร้างตารางฐานข้อมูล ERD (9 ตาราง)',
      description: 'ความเห็นพี่เลี้ยง: “ช่วยแนบไฟล์ภาพ Diagram ความละเอียดสูงเพิ่มครับ”',
      startTime: '09:00 น.',
      endTime: '15:30 น.',
      workStatus: 'completed',
      reviewStatus: 'returned',
    },
    {
      id: 4,
      date: '21-11-2569',
      title: 'ประชุมสรุป Requirement ระบบจัดการเวลาฝึกงาน',
      description: 'อนุมัติโดย: วิชัย พัฒนาการ (21 พ.ย. 2569 17:10 น.)',
      startTime: '10:00 น.',
      endTime: '12:15 น.',
      workStatus: 'completed',
      reviewStatus: 'approved',
    },
  ]

  const summary = {
    approvedCount: 18,
    waitingReview: 2,
    returned: 1,
  }

  return {
    user,
    internship,
    worklogs,
    summary,
  }
}
