/**
 * ข้อผิดพลาดที่ตั้งใจตอบกลับ message ต้องเป็นภาษาไทยที่แสดงให้ผู้ใช้ได้
 * code และ lockedUntil ตาม docs/api-contract.md
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: { code?: string, lockedUntil?: string } = {},
  ) {
    super(message)
  }
}
