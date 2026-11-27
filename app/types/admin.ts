// ข้อมูลของพื้นที่แอดมิน รูปแบบเดียวกับ worklog.ts (วันเวลา = ISO 8601)

export interface SystemSettings {
  /** บันทึกและแก้ไขย้อนหลังได้กี่วัน (5.6) */
  backdateLimitDays: number
  /** รอตรวจเกินกี่วันถือว่าค้างตรวจ (9.3) */
  reviewOverdueDays: number
  /** กรอกรหัสผ่านผิดกี่ครั้งจึงล็อกบัญชี แก้ที่หน้าจอไม่ได้ (1.2) */
  maxFailedLogins: number
  /** ล็อกกี่นาที แก้ที่หน้าจอไม่ได้ (1.2) */
  lockMinutes: number
  /** ไม่มีค่า = ยังไม่เคยแก้ */
  updatedAt?: string
  updatedBy?: string
}

export type SystemSettingsInput = Pick<SystemSettings, 'backdateLimitDays' | 'reviewOverdueDays'>

export interface AdminApi {
  getSystemSettings(): Promise<SystemSettings>
  /** คืนค่าล่าสุดหลังบันทึก */
  saveSystemSettings(input: SystemSettingsInput): Promise<SystemSettings>
}
