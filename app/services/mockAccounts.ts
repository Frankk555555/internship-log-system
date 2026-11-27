// บัญชีทดสอบของข้อมูลจำลองเท่านั้น ห้ามใช้รหัสผ่านเหล่านี้กับระบบจริง
import type { UserProfile } from '~/types/worklog'
import { admin, kitti, manop, mentor, napha, piyaporn, prasert, seedTime, student, supaporn, suspendedStudent, thana, thanawat } from './mockData'

export interface MockAccount {
  id: number
  password: string
  suspended?: boolean
  lastLoginAt?: string
  /** แสดงเป็นปุ่มบัญชีทดสอบในหน้าเข้าสู่ระบบ note คือข้อความเสริมบนปุ่ม */
  demo?: { note?: string }
  profile: UserProfile
}

/** นักศึกษาใหม่ รหัสผ่านเริ่มต้นคือรหัสนักศึกษา และต้องตั้งใหม่เมื่อเข้าครั้งแรก */
function newStudent(id: number, profile: UserProfile): MockAccount {
  return { id, password: profile.studentId!, profile }
}

// ลำดับในรายการคือลำดับในหน้าผู้ใช้งาน บัญชีที่เพิ่มใหม่ขึ้นก่อน
export const mockAccounts: MockAccount[] = [
  { id: 1, password: 'Student#2569', demo: {}, lastLoginAt: seedTime(0, '08:42'), profile: student },
  { id: 2, password: 'Student#2569', lastLoginAt: seedTime(1, '14:20'), profile: napha },
  { id: 3, password: 'Student#2569', lastLoginAt: seedTime(1, '16:40'), profile: thana },
  { ...newStudent(4, piyaporn), demo: { note: 'เข้าครั้งแรก' } },
  { id: 5, password: 'Mentor#2569', demo: {}, lastLoginAt: seedTime(1, '17:05'), profile: mentor },
  { id: 6, password: 'Mentor#2569', lastLoginAt: seedTime(2, '09:30'), profile: supaporn },
  { id: 7, password: 'Suspended#2569', suspended: true, lastLoginAt: seedTime(56, '10:00'), profile: suspendedStudent },
  { id: 8, password: 'Admin#2569', demo: {}, lastLoginAt: seedTime(0, '08:05'), profile: admin },
  newStudent(9, thanawat),
  newStudent(10, kitti),
  { id: 11, password: 'Mentor#2569', lastLoginAt: seedTime(6, '13:15'), profile: prasert },
  { id: 12, password: 'Admin#2569', lastLoginAt: seedTime(9, '11:00'), profile: manop },
]
