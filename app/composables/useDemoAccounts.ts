import { mockAccounts } from '~/services/mockAccounts'

/** บัญชีสำหรับกดเข้าสู่ระบบเมื่อใช้ข้อมูลจำลอง ต่อ backend จริงแล้วจะไม่มีบัญชีใดเลย */
export function useDemoAccounts() {
  if (useRuntimeConfig().public.apiBase) return []

  return mockAccounts
    .filter(account => !account.suspended)
    .map(({ profile, password }) => ({ role: profile.role, name: profile.name, email: profile.email, password }))
}
