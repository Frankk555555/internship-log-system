/** ย้อนไปหน้าที่กดเข้ามา ถ้าไม่มีหรือย้อนไปไม่ได้ ให้ไป fallback */
export function useGoBack() {
  const router = useRouter()

  return (fallback: string, isUnusable?: (path: string) => boolean) => {
    // vue-router เก็บหน้าก่อนหน้าไว้ใน history.state และไม่ย้อนกลับไปหน้าเข้าสู่ระบบ
    const previous = window.history.state?.back
    if (typeof previous === 'string' && !previous.startsWith('/login') && !isUnusable?.(previous)) return router.back()
    return router.push(fallback)
  }
}
