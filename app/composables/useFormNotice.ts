/** ผลของปุ่มในฟอร์ม แจ้งด้วยข้อความมุมจอทุกครั้ง ข้อผิดพลาดค้างไว้ในฟอร์มด้วยเพื่อให้แก้ตาม */
export function useFormNotice() {
  const notify = useNotify()
  const error = ref<string>()

  return {
    error,
    clear: () => {
      error.value = undefined
    },
    fail: (message: string, title = 'ทำรายการไม่สำเร็จ') => {
      error.value = message
      notify('error', title, message)
    },
    done: (title: string, description: string) => {
      error.value = undefined
      notify('success', title, description)
    },
  }
}
