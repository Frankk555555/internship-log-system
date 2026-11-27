/** เวลาปัจจุบันตามเซิร์ฟเวอร์ เดินต่อเองเพื่อให้หน้าจอเปลี่ยนเมื่อเลยเวลาเลิกงาน */
export function useServerClock() {
  const api = useApi()
  const now = shallowRef<ReturnType<typeof toThaiTimeParts>>()
  let timer: ReturnType<typeof setInterval> | undefined
  let isActive = true

  onMounted(async () => {
    try {
      const offset = Date.parse(await api.getServerTime()) - Date.now()
      if (!isActive) return

      const tick = () => {
        now.value = toThaiTimeParts(new Date(Date.now() + offset).toISOString())
      }
      tick()
      timer = setInterval(tick, 1000)
    }
    catch {
      // อ่านเวลาไม่ได้ หน้าจอคงปุ่มแบบเดิม เซิร์ฟเวอร์ยังตรวจเวลาตอนบันทึก
    }
  })

  onBeforeUnmount(() => {
    isActive = false
    clearInterval(timer)
  })

  return now
}
