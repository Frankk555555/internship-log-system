/** นับถอยหลังเป็นวินาทีจนถึงเวลาที่กำหนด */
export function useCountdown() {
  const remaining = ref(0)
  let target = 0
  let timer: ReturnType<typeof setInterval> | undefined

  function stop() {
    clearInterval(timer)
    timer = undefined
  }

  function tick() {
    // คำนวณจากเวลาเป้าหมาย ไม่คลาดเคลื่อนเมื่อแท็บถูกพักไว้
    remaining.value = Math.max(0, Math.ceil((target - Date.now()) / 1000))
    if (!remaining.value) stop()
  }

  function startUntil(timestamp: number) {
    stop()
    target = timestamp
    timer = setInterval(tick, 500)
    tick()
  }

  onBeforeUnmount(stop)

  return { remaining, startUntil }
}
