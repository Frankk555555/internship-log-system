// บัญชีทดสอบของข้อมูลจำลองเท่านั้น ห้ามใช้รหัสผ่านเหล่านี้กับระบบจริง
import type { UserProfile } from '~/types/worklog'
import { admin, mentor, student } from './mockData'

export interface MockAccount {
  password: string
  suspended?: boolean
  profile: UserProfile
}

export const mockAccounts: MockAccount[] = [
  { password: 'Student#2569', profile: student },
  { password: 'Mentor#2569', profile: mentor },
  { password: 'Admin#2569', profile: admin },
  {
    password: 'Suspended#2569',
    suspended: true,
    profile: { ...student, name: 'บัญชี ทดสอบระงับ', firstName: 'บัญชี', lastName: 'ทดสอบระงับ', email: 'suspended@university.ac.th', studentId: '66011233499' },
  },
]
