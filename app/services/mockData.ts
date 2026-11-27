import type { DeletedWorklog, UnavailabilityInput } from '~/types/review'
import type { Attachment, HistoryEvent, InternshipInfo, ReviewStatus, UserProfile, WorkLog } from '~/types/worklog'
import { addDays, toThaiTimeParts } from '~/utils/date'

// ข้อมูลตัวอย่างตามภาพออกแบบ ใช้จนกว่าจะเชื่อม backend

const thaiToday = () => toThaiTimeParts(new Date().toISOString()).date

/** วันนี้ตามเวลาไทย */
// eslint-disable-next-line import/no-mutable-exports -- refreshToday() ต้องเปลี่ยนค่าได้ ผู้ใช้อ่านค่าล่าสุดผ่าน db.TODAY
export let TODAY = thaiToday()

/** เปิดระบบค้างข้ามคืน วันนี้ต้องเลื่อนตาม รายการเดิมคงวันที่ไว้ */
export function refreshToday() {
  TODAY = thaiToday()
}

// วันที่ของข้อมูลตัวอย่างคิดเทียบกับวันที่เปิดระบบ
const daysAgo = (days: number) => addDays(TODAY, -days)
// ข้อมูลช่วงต้นฝึกงานเลื่อนครั้งละสัปดาห์ ให้ตรงกับวันในสัปดาห์เดิม
const weekShift = Math.floor((Date.parse(TODAY) - Date.parse('2026-11-24')) / (7 * 86_400_000)) * 7
const earlier = (date: string) => addDays(date, weekShift)

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
  defaultReportDate: daysAgo(4),
}

export const internship: InternshipInfo = {
  company: 'บริษัท เทคคอร์ป ประเทศไทย จำกัด',
  position: 'Full stack developer',
  mentorName: mentor.name,
  semester: 'ภาคการศึกษาที่ 1/2569',
  progress: 68,
  startDate: earlier('2026-09-01'),
  endDate: earlier('2026-12-25'),
  workStartTime: '08:00',
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
  entry(191, earlier('2026-09-07'), 'ปฐมนิเทศและติดตั้งเครื่องมือ', '09:00', '12:00', 'approved'),
  entry(192, earlier('2026-09-08'), 'ศึกษาโครงสร้างระบบเดิม', '13:00', '16:30', 'approved'),
  entry(202, earlier('2026-09-15'), 'ออกแบบหน้าจอเข้าสู่ระบบ', '09:00', '12:00', 'approved'),
  entry(204, earlier('2026-09-16'), 'ประชุมวางแผนโครงการ', '09:00', '11:30', 'returned', {
    reviewComment: 'ช่วยเพิ่มสรุปผลการประชุมและรายชื่อผู้เข้าร่วมครับ',
    reviewedBy: mentor.name,
    reviewedAt: thaiTime(earlier('2026-09-17'), '09:30'),
  }),
  entry(205, earlier('2026-09-16'), 'เขียนเอกสารความต้องการระบบ', '13:00', '16:00', 'approved'),
  pending(201, daysAgo(4), 'วิเคราะห์ความต้องการผู้ใช้', '09:00', '13:00', '17:10', 'สัมภาษณ์ผู้ใช้งาน 3 ราย สรุปความต้องการหลักและจัดลำดับความสำคัญ', [['interview-summary.pdf', 980 * 1024], ['meeting-photo.jpg', 1.6 * MB]]),
  entry(105, daysAgo(3), 'ประชุมสรุป Requirement ระบบจัดการเวลาฝึกงาน', '10:00', '12:15', 'approved', {
    reviewedBy: mentor.name,
    reviewedAt: thaiTime(daysAgo(3), '17:10'),
  }),
  pending(203, daysAgo(3), 'ทดสอบฟอร์มลงทะเบียน', '13:00', '15:00', '15:30', 'ทดสอบการกรอกข้อมูลและข้อความแจ้งเตือนของฟอร์มลงทะเบียน', [['register-test.docx', 240 * 1024]]),
  pending(104, daysAgo(2), 'ประชุมทีมพัฒนา', '13:00', '15:00', '17:00', 'ประชุมติดตามความคืบหน้าและแบ่งงานของสัปดาห์', [['minutes.pdf', 320 * 1024]]),
  entry(3, daysAgo(2), 'ออกแบบโครงสร้างตารางฐานข้อมูล ERD (9 ตาราง)', '15:00', '17:00', 'returned', {
    description: 'ออกแบบ ERD ฐานข้อมูลของระบบบันทึกงานจำนวน 9 ตาราง',
    attachments: [{ id: 30, name: 'erd-diagram.png', size: 640 * 1024, uploadedAt: thaiTime(daysAgo(2), '17:00') }],
    reviewComment: 'ช่วยแนบไฟล์ภาพ Diagram ความละเอียดสูงเพิ่มครับ',
    reviewedBy: mentor.name,
    reviewedAt: thaiTime(daysAgo(1), '09:00'),
  }),
  entry(101, daysAgo(1), 'ออกแบบฟอร์มบันทึกงาน', '09:00', '12:00', 'approved'),
  pending(102, daysAgo(1), 'ทดสอบฟอร์ม', '13:00', '15:00', '15:10', 'ทดสอบฟอร์มบันทึกงานตามกรณีทดสอบ', [['form-test.pdf', 410 * 1024]]),
  { id: 103, date: daysAgo(1), title: 'จัดทำภาพประกอบ', workStatus: 'pending', reviewStatus: 'draft', version: 1 },
  {
    id: 1,
    date: TODAY,
    title: 'เชื่อมต่อ API ระบบอัปโหลดไฟล์หลักฐานแบบ',
    description: 'สร้างรายการไร้ส่วนหน้า • ยังไม่ทดลองทำงาน',
    workStatus: 'pending',
    reviewStatus: 'draft',
    version: 1,
  },
]

/** นักศึกษาคนอื่นในความดูแลของพี่เลี้ยงคนเดียวกัน */
export const otherStudents = [
  {
    studentId: '66011233467',
    name: 'นภา สุขสันต์',
    email: 'napha.s@university.ac.th',
    company: internship.company,
    position: 'UX/UI designer',
    startDate: internship.startDate,
    endDate: internship.endDate,
    worklogs: [
      entry(301, earlier('2026-09-14'), 'ออกแบบฐานข้อมูลผู้ใช้', '09:00', '12:00', 'approved'),
      entry(303, earlier('2026-09-18'), 'ร่างคู่มือการใช้งาน', '13:00', '15:00', 'draft'),
      pending(311, daysAgo(3), 'สรุปผลการทดสอบระบบ', '09:00', '12:00', '16:45', 'รวบรวมผลการทดสอบและจัดลำดับปัญหาที่พบ', [['test-report.pdf', 760 * 1024]]),
      pending(312, daysAgo(2), 'ประสานงานกับฝ่ายบุคคล', '13:00', '15:00', '15:55', 'นัดหมายและสรุปข้อมูลที่ต้องใช้กับฝ่ายบุคคล', [['hr-summary.docx', 180 * 1024]]),
    ],
  },
  {
    studentId: '66011233468',
    name: 'ธนา มั่นคง',
    email: 'thana.m@university.ac.th',
    company: internship.company,
    position: 'Data analyst',
    startDate: internship.startDate,
    endDate: internship.endDate,
    worklogs: [
      pending(401, daysAgo(2), 'เตรียมข้อมูลสำหรับรายงาน', '10:00', '12:30', '13:20', 'ตรวจความครบถ้วนและจัดรูปแบบข้อมูลสำหรับรายงาน', [['report-data.pdf', 520 * 1024]]),
      pending(402, daysAgo(2), 'อบรมการใช้งานระบบ', '15:00', '16:30', '16:40', 'อบรมการใช้งานระบบบันทึกงานให้ผู้ใช้ใหม่', [['training-photo.jpg', 1.1 * MB]]),
    ],
  },
]

/** รายการที่ลบแล้ว เก็บไว้ตรวจสอบย้อนหลัง ใหม่สุดก่อน (backend ใช้ soft delete) */
export const deletedWorklogs: DeletedWorklog[] = []

/** ช่วงที่พี่เลี้ยงแจ้งว่าไม่สะดวกตรวจงาน */
export const unavailabilities: UnavailabilityInput[] = [
  { date: TODAY, startTime: '09:00', endTime: '12:00', reason: 'ประชุมแผน Sprint กับลูกค้า' },
]

const at = (time: string) => thaiTime(daysAgo(1), time)

/** ประวัติของแต่ละรายการ (key = id) เรียงจากใหม่ไปเก่า */
export const histories: Record<number, HistoryEvent[]> = {
  3: [
    { id: 32, type: 'return', changedAt: thaiTime(daysAgo(1), '09:00'), title: 'ส่งกลับ: ช่วยแนบไฟล์ภาพ Diagram ความละเอียดสูงเพิ่มครับ', actorName: mentor.name, before: 'รอตรวจ', after: 'ส่งกลับแก้ไข' },
    { id: 31, type: 'status', changedAt: thaiTime(daysAgo(2), '17:00'), title: 'ส่งตรวจ', actorName: student.name, before: 'ฉบับร่าง', after: 'รอตรวจ' },
  ],
  204: [
    { id: 2042, type: 'return', changedAt: thaiTime(earlier('2026-09-17'), '09:30'), title: 'ส่งกลับ: ช่วยเพิ่มสรุปผลการประชุมและรายชื่อผู้เข้าร่วมครับ', actorName: mentor.name, before: 'รอตรวจ', after: 'ส่งกลับแก้ไข' },
    { id: 2041, type: 'status', changedAt: thaiTime(earlier('2026-09-16'), '17:00'), title: 'ส่งตรวจ', actorName: student.name, before: 'ฉบับร่าง', after: 'รอตรวจ' },
  ],
  101: [
    { id: 5, type: 'approval', changedAt: at('14:20'), title: 'ผู้อนุมัติ', actorName: mentor.name, before: 'รอตรวจ', after: 'อนุมัติแล้ว' },
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
