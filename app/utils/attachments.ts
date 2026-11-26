// ชนิดและขนาดไฟล์ตามขอบเขตงานข้อ 6.1 (backend ต้องตรวจซ้ำด้วย)
export const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf', 'docx']
export const maxFileSize = 5 * 1024 * 1024

export function extensionOf(name: string) {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
}

/** ข้อความเมื่อไฟล์ไม่ผ่านเงื่อนไข หรือ undefined ถ้าใช้ได้ */
export function fileError(file: File) {
  if (!allowedExtensions.includes(extensionOf(file.name))) return `${file.name}: ไม่รองรับไฟล์ชนิดนี้`
  if (file.size > maxFileSize) return 'ขนาดไฟล์เกิน 5MB กรุณาเลือกไฟล์ใหม่'
  return undefined
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
