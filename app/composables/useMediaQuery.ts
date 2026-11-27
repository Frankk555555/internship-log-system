/** ติดตาม media query ฝั่งเบราว์เซอร์ initial คือค่าที่ใช้ตอน render ฝั่งเซิร์ฟเวอร์ */
export function useMediaQuery(query: string, initial = true) {
  const matches = ref(initial)
  let list: MediaQueryList | undefined

  function update(event: MediaQueryListEvent) {
    matches.value = event.matches
  }

  onMounted(() => {
    list = window.matchMedia(query)
    matches.value = list.matches
    list.addEventListener('change', update)
  })
  onBeforeUnmount(() => list?.removeEventListener('change', update))

  return matches
}
