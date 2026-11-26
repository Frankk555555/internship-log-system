import type { UnavailabilityInput } from '~/types/review'
import type { Attachment, HistoryEvent, InternshipInfo, ReviewStatus, UserProfile, WorkLog } from '~/types/worklog'

// ข้อมูลตัวอย่างตามภาพออกแบบ ใช้จนกว่าจะเชื่อม backend

export const TODAY = '2026-11-24'
export const DAILY_DATE = '2026-11-23'
export const BACKDATE_LIMIT_DAYS = 3
export const REVIEW_OVERDUE_DAYS = 3
const MB = 1024 * 1024

export const student: UserProfile = {
  name: 'สมชาย ใจดี',
  email: 'somchai.k@university.ac.th',
  initials: 'สช',
  studentId: '66011233466',
  role: 'student',
  unreadNotifications: 3,
  defaultReportDate: TODAY,
}

export const mentor: UserProfile = {
  name: 'วิชัย พัฒนาการ',
  email: 'wichai.p@university.ac.th',
  initials: 'วพ',
  role: 'supervisor',
  unreadNotifications: 3,
  defaultReportDate: '2026-11-20',
}

export const internship: InternshipInfo = {
  company: 'บริษัท เทคคอร์ป ประเทศไทย จำกัด',
  position: 'Full stack developer',
  mentorName: mentor.name,
  semester: 'ภาคการศึกษาที่ 1/2569',
  progress: 68,
  startDate: '2026-09-01',
  endDate: '2026-12-25',
  workEndTime: '17:00',
}

const thaiTime = (date: string, time: string) => `${date}T${time}:00+07:00`

function entry(id: number, date: string, title: string, startTime: string, endTime: string, reviewStatus: ReviewStatus, extra: Partial<WorkLog> = {}): WorkLog {
  return {
    id,
    date,
    title,
    startTime,
    endTime,
    workStatus: 'done',
    reviewStatus,
    version: 1,
    submittedAt: reviewStatus === 'draft' ? undefined : thaiTime(date, '17:00'),
    ...extra,
  }
}

/** รายการที่รอตรวจ พร้อมรายละเอียดและไฟล์แนบ */
function pending(id: number, date: string, title: string, startTime: string, endTime: string, submittedTime: string, description: string, files: [string, number][]) {
  const submittedAt = thaiTime(date, submittedTime)
  const attachments: Attachment[] = files.map(([name, size], index) => ({ id: id * 10 + index, name, size, uploadedAt: submittedAt }))
  return entry(id, date, title, startTime, endTime, 'submitted', { submittedAt, description, attachments })
}

/** รายการงานทั้งหมดของนักศึกษา */
export const studentWorklogs: WorkLog[] = [
  entry(191, '2026-09-07', 'ปฐมนิเทศและติดตั้งเครื่องมือ', '09:00', '12:00', 'approved'),
  entry(192, '2026-09-08', 'ศึกษาโครงสร้างระบบเดิม', '13:00', '16:30', 'approved'),
  entry(202, '2026-09-15', 'ออกแบบหน้าจอเข้าสู่ระบบ', '09:00', '12:00', 'approved'),
  entry(204, '2026-09-16', 'ประชุมวางแผนโครงการ', '09:00', '11:30', 'returned', {
    reviewComment: 'ช่วยเพิ่มสรุปผลการประชุมและรายชื่อผู้เข้าร่วมครับ',
    reviewedBy: mentor.name,
    reviewedAt: thaiTime('2026-09-17', '09:30'),
  }),
  entry(205, '2026-09-16', 'เขียนเอกสารความต้องการระบบ', '13:00', '16:00', 'approved'),
  pending(201, '2026-11-20', 'วิเคราะห์ความต้องการผู้ใช้', '09:00', '13:00', '17:10', 'สัมภาษณ์ผู้ใช้งาน 3 ราย สรุปความต้องการหลักและจัดลำดับความสำคัญ', [['interview-summary.pdf', 980 * 1024], ['meeting-photo.jpg', 1.6 * MB]]),
  entry(105, '2026-11-21', 'ประชุมสรุป Requirement ระบบจัดการเวลาฝึกงาน', '10:00', '12:15', 'approved'),
  pending(203, '2026-11-21', 'ทดสอบฟอร์มลงทะเบียน', '13:00', '15:00', '15:30', 'ทดสอบการกรอกข้อมูลและข้อความแจ้งเตือนของฟอร์มลงทะเบียน', [['register-test.docx', 240 * 1024]]),
  pending(104, '2026-11-22', 'ประชุมทีมพัฒนา', '13:00', '15:00', '17:00', 'ประชุมติดตามความคืบหน้าและแบ่งงานของสัปดาห์', [['minutes.pdf', 320 * 1024]]),
  entry(3, '2026-11-22', 'ออกแบบโครงสร้างตารางฐานข้อมูล ERD (9 ตาราง)', '15:00', '17:00', 'returned', {
    description: 'ออกแบบ ERD ฐานข้อมูลของระบบบันทึกงานจำนวน 9 ตาราง',
    attachments: [{ id: 30, name: 'erd-diagram.png', size: 640 * 1024, uploadedAt: thaiTime('2026-11-22', '17:00') }],
    reviewComment: 'ช่วยแนบไฟล์ภาพ Diagram ความละเอียดสูงเพิ่มครับ',
    reviewedBy: mentor.name,
    reviewedAt: thaiTime('2026-11-23', '09:00'),
  }),
  entry(101, DAILY_DATE, 'ออกแบบฟอร์มบันทึกงาน', '09:00', '12:00', 'approved'),
  pending(102, DAILY_DATE, 'ทดสอบฟอร์ม', '13:00', '15:00', '15:10', 'ทดสอบฟอร์มบันทึกงานตามกรณีทดสอบ', [['form-test.pdf', 410 * 1024]]),
  { id: 103, date: DAILY_DATE, title: 'จัดทำภาพประกอบ', workStatus: 'pending', reviewStatus: 'draft', version: 1 },
]

/** นักศึกษาคนอื่นในความดูแลของพี่เลี้ยงคนเดียวกัน */
export const otherStudents = [
  {
    studentId: '66011233467',
    name: 'นภา สุขสันต์',
    worklogs: [
      entry(301, '2026-09-14', 'ออกแบบฐานข้อมูลผู้ใช้', '09:00', '12:00', 'approved'),
      entry(303, '2026-09-18', 'ร่างคู่มือการใช้งาน', '13:00', '15:00', 'draft'),
      pending(311, '2026-11-21', 'สรุปผลการทดสอบระบบ', '09:00', '12:00', '16:45', 'รวบรวมผลการทดสอบและจัดลำดับปัญหาที่พบ', [['test-report.pdf', 760 * 1024]]),
      pending(312, '2026-11-22', 'ประสานงานกับฝ่ายบุคคล', '13:00', '15:00', '15:55', 'นัดหมายและสรุปข้อมูลที่ต้องใช้กับฝ่ายบุคคล', [['hr-summary.docx', 180 * 1024]]),
    ],
  },
  {
    studentId: '66011233468',
    name: 'ธนา มั่นคง',
    worklogs: [
      pending(401, '2026-11-22', 'เตรียมข้อมูลสำหรับรายงาน', '10:00', '12:30', '13:20', 'ตรวจความครบถ้วนและจัดรูปแบบข้อมูลสำหรับรายงาน', [['report-data.pdf', 520 * 1024]]),
      pending(402, '2026-11-22', 'อบรมการใช้งานระบบ', '15:00', '16:30', '16:40', 'อบรมการใช้งานระบบบันทึกงานให้ผู้ใช้ใหม่', [['training-photo.jpg', 1.1 * MB]]),
    ],
  },
]

/** ตารางหน้าหลัก (ชุดตัวอย่างตามภาพออกแบบ แยกจากรายการข้างบน) */
export const dashboardSummary = { approvedCount: 18, waitingReviewCount: 2, returnedCount: 1 }

export const dashboardWorklogs: WorkLog[] = [
  {
    id: 1,
    date: DAILY_DATE,
    title: 'เชื่อมต่อ API ระบบอัปโหลดไฟล์หลักฐานแบบ',
    description: 'สร้างรายการไร้ส่วนหน้า • ยังไม่ทดลองทำงาน',
    workStatus: 'pending',
    reviewStatus: 'draft',
  },
  {
    id: 2,
    date: DAILY_DATE,
    title: 'พัฒนาหน้าจอ Dashboard พอร์ทัลนักศึกษาด้วย Nuxt.js',
    description: 'กำลังดำเนินการ... ต้องทำงานเสร็จสิ้นก่อนจึงจะส่งตรวจได้',
    startTime: '08:45',
    workStatus: 'in_progress',
    reviewStatus: 'draft',
  },
  // ข้อมูลของรายการนี้มาจาก studentWorklogs
  studentWorklogs.find(log => log.id === 3)!,
  {
    id: 4,
    date: '2026-11-21',
    title: 'ประชุมสรุป Requirement ระบบจัดการเวลาฝึกงาน',
    description: 'อนุมัติโดย: วิชัย พัฒนาการ (21 พ.ย. 2569 17:10 น.)',
    startTime: '10:00',
    endTime: '12:15',
    workStatus: 'done',
    reviewStatus: 'approved',
  },
]

/** ช่วงที่พี่เลี้ยงแจ้งว่าไม่สะดวกตรวจงาน */
export const unavailabilities: UnavailabilityInput[] = [
  { date: DAILY_DATE, startTime: '09:00', endTime: '12:00', reason: 'ประชุมแผน Sprint กับลูกค้า' },
]

export const formDefaults = {
  // วันที่และเวลาเริ่มของรายการใหม่กำหนดตอนเปิดฟอร์ม
  new: {
    date: TODAY,
    startTime: undefined as string | undefined,
    title: 'พัฒนาหน้าจอ Dashboard พอร์ทัลนักศึกษาด้วย Nuxt.js',
    description: [
      '1. สร้าง Layout หลักและ Sidebar แยกตาม Role นักศึกษา',
      '2. เชื่อมต่อ Eden Treaty ดึงข้อมูลสถานที่ฝึกงานและแบนเนอร์สถานะพี่เลี้ยง (mentor_busy)',
      '3. พัฒนาระบบปุ่มเวลาเริ่มงานและเวลาทำงานเสร็จสิ้นตามเวลาจริงของเซิร์ฟเวอร์',
    ].join('\n'),
    attachments: [
      { id: 1, name: 'dashboard_ui_v1.png', size: 1.42 * MB, uploadedAt: `${TODAY}T09:10:00+07:00` },
    ],
  },
  backdate: {
    date: '2026-11-22',
    startTime: '09:00',
    endTime: '11:30',
    title: 'ปรับแบบฟอร์ม',
    description: 'จัดวางช่องกรอกและปรับข้อความเตือน',
    attachments: [
      { id: 2, name: 'form-v2.png', size: 1.42 * MB, uploadedAt: `${TODAY}T09:10:00+07:00` },
    ],
  },
}

const at = (time: string) => `${DAILY_DATE}T${time}:00+07:00`

/** ประวัติของแต่ละรายการ (key = id) เรียงจากใหม่ไปเก่า */
export const histories: Record<number, HistoryEvent[]> = {
  3: [
    { id: 32, type: 'return', changedAt: '2026-11-23T09:00:00+07:00', title: 'ส่งกลับ: ช่วยแนบไฟล์ภาพ Diagram ความละเอียดสูงเพิ่มครับ', actorName: mentor.name, before: 'รอตรวจ', after: 'ส่งกลับแก้ไข' },
    { id: 31, type: 'status', changedAt: '2026-11-22T17:00:00+07:00', title: 'ส่งตรวจ', actorName: student.name, before: 'ฉบับร่าง', after: 'รอตรวจ' },
  ],
  204: [
    { id: 2042, type: 'return', changedAt: '2026-09-17T09:30:00+07:00', title: 'ส่งกลับ: ช่วยเพิ่มสรุปผลการประชุมและรายชื่อผู้เข้าร่วมครับ', actorName: mentor.name, before: 'รอตรวจ', after: 'ส่งกลับแก้ไข' },
    { id: 2041, type: 'status', changedAt: '2026-09-16T17:00:00+07:00', title: 'ส่งตรวจ', actorName: student.name, before: 'ฉบับร่าง', after: 'รอตรวจ' },
  ],
  101: [
    { id: 5, type: 'approval', changedAt: at('14:20'), title: 'ผู้อนุมัติ', actorName: mentor.name, before: 'รอตรวจ', after: 'อนุมัติ' },
    { id: 4, type: 'edit', changedAt: at('14:05'), title: 'แก้ไขหลักฐานและส่งตรวจใหม่', actorName: student.name, before: 'form-v1.png · 240 KB', after: 'form-v2.png · 820 KB' },
    { id: 3, type: 'return', changedAt: at('13:45'), title: 'ส่งกลับให้แนบภาพความละเอียดสูง', actorName: mentor.name, before: 'รอตรวจ', after: 'ส่งกลับแก้ไข' },
    { id: 2, type: 'status', changedAt: at('12:00'), title: 'กำลังดำเนินการ → เสร็จสิ้น', actorName: student.name, before: 'กำลังดำเนินการ', after: 'เสร็จสิ้น' },
    { id: 1, type: 'status', changedAt: at('09:00'), title: 'รอดำเนินการ → กำลังดำเนินการ', actorName: student.name, before: 'รอดำเนินการ', after: 'กำลังดำเนินการ' },
  ],
}

// รายการอื่นที่ส่งเข้ามาแล้วมีประวัติ "ส่งตรวจ" อย่างน้อย 1 เหตุการณ์
for (const { name, worklogs } of [{ name: student.name, worklogs: studentWorklogs }, ...otherStudents]) {
  for (const log of worklogs) {
    if (!log.submittedAt || histories[log.id]) continue
    histories[log.id] = [{ id: log.id * 10, type: 'status', changedAt: log.submittedAt, title: 'ส่งตรวจ', actorName: name, before: 'ฉบับร่าง', after: 'รอตรวจ' }]
  }
}
