// บัญชีทดสอบของข้อมูลจำลองเท่านั้น ห้ามใช้รหัสผ่านเหล่านี้กับระบบจริง
import type { UserProfile, UserRole } from '~/types/worklog'
import { initialsOf } from '~/utils/auth'
import { admin, mentor, otherStudents, seedTime, student } from './mockData'

export interface MockAccount {
  id: number
  password: string
  suspended?: boolean
  lastLoginAt?: string
  /** แสดงเป็นปุ่มบัญชีทดสอบในหน้าเข้าสู่ระบบ note คือข้อความเสริมบนปุ่ม */
  demo?: { note?: string }
  profile: UserProfile
}

function person(role: UserRole, firstName: string, lastName: string, email: string, studentId?: string): UserProfile {
  return { name: `${firstName} ${lastName}`, firstName, lastName, email, initials: initialsOf(firstName, lastName), studentId, role, defaultReportDate: student.defaultReportDate }
}

/** นักศึกษาที่พี่เลี้ยงตัวอย่างดูแลอยู่แล้ว */
function mentored(studentId: string) {
  const found = otherStudents.find(other => other.studentId === studentId)!
  const [firstName = '', ...rest] = found.name.split(' ')
  return person('student', firstName, rest.join(' '), found.email, found.studentId)
}

/** นักศึกษาใหม่ รหัสผ่านเริ่มต้นคือรหัสนักศึกษา และต้องตั้งใหม่เมื่อเข้าครั้งแรก */
function newStudent(id: number, firstName: string, lastName: string, email: string, studentId: string): MockAccount {
  return { id, password: studentId, profile: { ...person('student', firstName, lastName, email, studentId), mustChangePassword: true } }
}

// ลำดับในรายการคือลำดับในหน้าผู้ใช้งาน บัญชีที่เพิ่มใหม่ขึ้นก่อน
export const mockAccounts: MockAccount[] = [
  { id: 1, password: 'Student#2569', demo: {}, lastLoginAt: seedTime(0, '08:42'), profile: student },
  { id: 2, password: 'Student#2569', lastLoginAt: seedTime(1, '14:20'), profile: mentored('66011233467') },
  { id: 3, password: 'Student#2569', lastLoginAt: seedTime(1, '16:40'), profile: mentored('66011233468') },
  { ...newStudent(4, 'ปิยะพร', 'แก้วมณี', 'piyaporn.k@university.ac.th', '66011233471'), demo: { note: 'เข้าครั้งแรก' } },
  { id: 5, password: 'Mentor#2569', demo: {}, lastLoginAt: seedTime(1, '17:05'), profile: mentor },
  { id: 6, password: 'Mentor#2569', lastLoginAt: seedTime(2, '09:30'), profile: person('supervisor', 'สุภาพร', 'วงศ์ใหญ่', 'supaporn.w@datawork.co.th') },
  {
    id: 7,
    password: 'Suspended#2569',
    suspended: true,
    lastLoginAt: seedTime(56, '10:00'),
    profile: person('student', 'บัญชี', 'ทดสอบระงับ', 'suspended@university.ac.th', '66011233499'),
  },
  { id: 8, password: 'Admin#2569', demo: {}, lastLoginAt: seedTime(0, '08:05'), profile: admin },
  newStudent(9, 'ธนวัฒน์', 'ใจงาม', 'thanawat.j@university.ac.th', '66011233470'),
  newStudent(10, 'กิตติ', 'ทองดี', 'kitti.t@university.ac.th', '66011233472'),
  { id: 11, password: 'Mentor#2569', lastLoginAt: seedTime(6, '13:15'), profile: person('supervisor', 'ประเสริฐ', 'ชัยมงคล', 'prasert.c@datawork.co.th') },
  { id: 12, password: 'Admin#2569', lastLoginAt: seedTime(9, '11:00'), profile: person('admin', 'มานพ', 'สุขเจริญ', 'manop.s@university.ac.th') },
]
