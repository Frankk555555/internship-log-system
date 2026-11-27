/** บัญชีสำหรับกดเข้าสู่ระบบเมื่อใช้ข้อมูลจำลอง ต่อ backend จริงแล้วจะไม่มีบัญชีใดเลย */
export function useDemoAccounts() {
  const { apiBase } = useRuntimeConfig().public

  const { data } = useLazyAsyncData('demo-accounts', async () => {
    if (apiBase) return []

    // โหลดแยก ให้บัญชีทดสอบและข้อมูลจำลองไม่ติดไปกับโค้ดหลัก
    const { mockAccounts } = await import('~/services/mockAccounts')
    return mockAccounts
      .filter(account => account.demo && !account.suspended)
      .map(({ profile, password, demo }) => ({ role: profile.role, name: profile.name, email: profile.email, password, note: demo!.note }))
  // โหลดฝั่งเบราว์เซอร์อย่างเดียว รหัสผ่านทดสอบจะได้ไม่ถูกฝังใน HTML ที่เซิร์ฟเวอร์ส่งมา
  }, { default: () => [], server: false })

  return data
}
