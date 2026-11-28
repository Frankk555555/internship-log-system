// ตัวนับในหน่วยความจำ ใช้ได้กับ backend ที่รันตัวเดียว เริ่มนับใหม่เมื่อรีสตาร์ต
const maxEntries = 10_000

function trim(map: Map<string, unknown>) {
  // Map เรียงตามลำดับที่เพิ่ม ลบรายการเก่าสุดก่อน กันหน่วยความจำโตไม่จำกัด
  for (const key of map.keys()) {
    if (map.size <= maxEntries) return
    map.delete(key)
  }
}

/** จำกัดจำนวนครั้งต่อคีย์ในช่วงเวลาหนึ่ง คืน false เมื่อเกิน */
export function createRateLimiter(limit: number, windowMs = 60_000) {
  const windows = new Map<string, { count: number, resetAt: number }>()

  return (key: string) => {
    const now = Date.now()
    let window = windows.get(key)
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs }
      windows.delete(key)
      windows.set(key, window)
      trim(windows)
    }
    window.count += 1
    return window.count <= limit
  }
}

/**
 * อีเมลที่ไม่มีบัญชีก็นับและล็อกแบบเดียวกับบัญชีจริง คนเดารหัสจึงแยกไม่ออกว่ามีบัญชีหรือไม่
 * บัญชีจริงนับในตาราง users
 */
export function createUnknownEmailGuard() {
  const records = new Map<string, { count: number, lockedUntil?: number }>()

  return {
    /** บันทึกการกรอกผิดหนึ่งครั้ง คืนเวลาปลดล็อก (ISO 8601) เมื่อถูกล็อกอยู่ */
    fail(email: string, maxFailures: number, lockMinutes: number) {
      const now = Date.now()
      let record = records.get(email)
      if (record?.lockedUntil) {
        if (record.lockedUntil > now) return new Date(record.lockedUntil).toISOString()
        record = undefined
      }
      const count = (record?.count ?? 0) + 1
      const lockedUntil = count >= maxFailures ? now + lockMinutes * 60_000 : undefined
      records.set(email, { count, lockedUntil })
      trim(records)
      return lockedUntil ? new Date(lockedUntil).toISOString() : undefined
    },
  }
}

export type UnknownEmailGuard = ReturnType<typeof createUnknownEmailGuard>
