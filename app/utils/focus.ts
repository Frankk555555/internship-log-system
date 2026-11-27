import { nextTick } from 'vue'

/** ย้ายโฟกัสไปช่องแรกที่ผิด ให้ผู้ใช้แป้นพิมพ์และโปรแกรมอ่านจอรู้ว่าต้องแก้ตรงไหน */
export async function focusFirstInvalid(root: HTMLElement | null) {
  // รอให้ช่องที่ผิดได้ aria-invalid ก่อน
  await nextTick()
  root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
