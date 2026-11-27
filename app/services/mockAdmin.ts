// ข้อมูลจำลองของแอดมิน โหลดพร้อม mockApi เมื่อใช้ข้อมูลจำลองเท่านั้น
import type { AdminApi } from '~/types/admin'
import { settingDayError } from '~/utils/adminRules'
import { ApiError } from './api'
import { currentAccount, requireRole } from './mockAuth'
import * as db from './mockData'
import type { MockSession } from './mockSession'

const wait = () => new Promise(resolve => setTimeout(resolve, 150))

/** now: เวลาเซิร์ฟเวอร์จำลอง ใช้บันทึกว่าแก้เมื่อไร */
export function createMockAdmin(session: MockSession, now: () => string): AdminApi {
  /** ทุกคำขอต้องเป็นแอดมิน คืนข้อมูลผู้ที่ทำรายการ */
  async function authorise() {
    await wait()
    requireRole(session, 'admin')
    db.refreshToday()
    return currentAccount(session).profile
  }

  return {
    async getSystemSettings() {
      await authorise()
      return structuredClone(db.settings)
    },

    async saveSystemSettings({ backdateLimitDays, reviewOverdueDays }) {
      const actor = await authorise()
      const problem = settingDayError(String(backdateLimitDays)) ?? settingDayError(String(reviewOverdueDays))
      if (problem) throw new ApiError(problem, 422)
      Object.assign(db.settings, { backdateLimitDays, reviewOverdueDays, updatedAt: now(), updatedBy: actor.name })
      return structuredClone(db.settings)
    },
  }
}
