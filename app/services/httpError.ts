// แปลงคำตอบที่ผิดพลาดของ backend เป็น ApiError ที่หน้าจอแสดงได้
import { ApiError } from './api'

interface ErrorBody {
  message?: unknown
  code?: unknown
  lockedUntil?: unknown
}

const unreachable = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่'

/** ข้อความเมื่อ backend ไม่ได้ส่งข้อความภาษาไทยมา */
const statusMessages: Record<number, string> = {
  400: 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่',
  401: 'กรุณาเข้าสู่ระบบอีกครั้ง',
  403: 'ไม่มีสิทธิ์ทำรายการนี้',
  404: 'ไม่พบข้อมูลที่ขอ',
  409: 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดใหม่แล้วลองอีกครั้ง',
  413: 'ไฟล์หรือข้อมูลมีขนาดใหญ่เกินไป',
  422: 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่',
  429: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
  502: unreachable,
  503: unreachable,
  504: unreachable,
}

/**
 * แสดงข้อความของ backend เฉพาะที่เป็นภาษาไทย ข้อความอื่น เช่น รายละเอียด validation
 * หรือข้อผิดพลาดภายในเซิร์ฟเวอร์ ไม่ใช่ข้อความสำหรับผู้ใช้
 */
function isUserMessage(message: unknown): message is string {
  return typeof message === 'string' && /[฀-๿]/.test(message) && !/^\s*[[{]/.test(message)
}

/** คำขอที่รอไฟล์ได้คำตอบผิดพลาดมาเป็น Blob */
async function errorBody(data: unknown): Promise<ErrorBody> {
  try {
    const value = data instanceof Blob ? JSON.parse(await data.text()) : data
    return value && typeof value === 'object' ? value as ErrorBody : {}
  }
  catch {
    return {}
  }
}

/** error: ที่ $fetch โยนมา reading: คำขออ่านอย่างเดียว (GET) */
export async function toApiError(error: unknown, reading: boolean) {
  const { statusCode, data, cause } = error as { statusCode?: number, data?: unknown, cause?: { name?: string } }
  const body = await errorBody(data)
  const timedOut = !statusCode && cause?.name === 'TimeoutError'
  const status = statusCode ?? (timedOut ? 504 : 503)

  const fallback = timedOut
    // คำขอที่แก้ข้อมูลอาจสำเร็จที่เซิร์ฟเวอร์แล้ว
    ? reading ? 'เซิร์ฟเวอร์ตอบช้าเกินไป กรุณาลองใหม่' : 'เซิร์ฟเวอร์ตอบช้าเกินไป ตรวจว่ารายการถูกบันทึกแล้วหรือยังก่อนลองใหม่'
    : statusMessages[status] ?? (status >= 500 ? 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่' : unreachable)

  return new ApiError(isUserMessage(body.message) ? body.message : fallback, status, {
    code: typeof body.code === 'string' ? body.code : undefined,
    lockedUntil: typeof body.lockedUntil === 'string' ? body.lockedUntil : undefined,
  })
}
