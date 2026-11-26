import type { UserRole } from '~/types/worklog'

/** เมนูและพื้นที่ทำงานแยกตามบทบาท (ขอบเขตงานข้อ 2.2) */
export const workspaces: Record<UserRole, { name: string, roleLabel: string, menus: { label: string, icon: string, to: string }[] }> = {
  student: {
    name: 'Student Workspace',
    roleLabel: 'นักศึกษา',
    menus: [
      { label: 'หน้าหลัก', icon: 'i-lucide-house', to: '/' },
      { label: 'บันทึกงานประจำวัน', icon: 'i-lucide-notebook-pen', to: '/worklogs' },
      { label: 'ข้อมูลสถานที่ฝึกงาน', icon: 'i-lucide-building-2', to: '/internship' },
      { label: 'ปฏิทินการทำงาน', icon: 'i-lucide-calendar', to: '/calendar' },
      { label: 'รายงานรายสัปดาห์', icon: 'i-lucide-file-text', to: '/reports' },
      { label: 'ตั้งค่าบัญชี', icon: 'i-lucide-settings', to: '/settings' },
    ],
  },
  supervisor: {
    name: 'Mentor Workspace',
    roleLabel: 'พี่เลี้ยง',
    menus: [
      { label: 'ตรวจงานนักศึกษา', icon: 'i-lucide-notebook-text', to: '/mentor/reviews' },
      { label: 'นักศึกษาในความดูแล', icon: 'i-lucide-users', to: '/mentor/students' },
      { label: 'ตารางเวลาไม่สะดวก', icon: 'i-lucide-calendar', to: '/mentor/unavailable' },
      { label: 'รายงานรายสัปดาห์', icon: 'i-lucide-file-text', to: '/mentor/reports' },
      { label: 'ตั้งค่าบัญชี', icon: 'i-lucide-settings', to: '/settings' },
    ],
  },
  admin: { name: 'Admin Workspace', roleLabel: 'แอดมิน', menus: [] },
}
