import { ApiError, type Api } from './api'

/**
 * เรียก REST API จริง เส้นทางและรูปแบบข้อมูลเป็นข้อเสนอ ดู docs/api-contract.md
 * เมื่อ backend กำหนดต่างจากนี้ ให้แก้ที่ไฟล์นี้ไฟล์เดียว
 */
export function createHttpApi(baseURL: string, headers?: Record<string, string>, onSessionExpired?: () => void): Api {
  async function request<T>(path: string, options: NonNullable<Parameters<typeof $fetch>[1]> = {}) {
    try {
      // credentials: ส่ง session cookie ไปด้วย
      return await $fetch(path, { baseURL, headers, credentials: 'include', ...options }) as T
    }
    catch (error) {
      const { statusCode, data } = error as { statusCode?: number, data?: { message?: string, code?: string, lockedUntil?: string } }
      // 401 จากเส้นทางข้อมูล = session หมดอายุ (เส้นทาง /auth และการอ่าน /me ให้ผู้เรียกจัดการเอง)
      const isSessionCheck = path === '/me' && !options.method
      if (statusCode === 401 && !isSessionCheck && !path.startsWith('/auth/')) onSessionExpired?.()
      throw new ApiError(data?.message ?? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่', statusCode ?? 503, data)
    }
  }

  return {
    getMe: () => request('/me'),
    login: body => request('/auth/login', { method: 'POST', body }),
    logout: async () => {
      await request('/auth/logout', { method: 'POST' })
    },
    requestPasswordReset: email => request('/auth/forgot-password', { method: 'POST', body: { email } }),
    resetPassword: async (token, newPassword) => {
      await request('/auth/reset-password', { method: 'POST', body: { token, newPassword } })
    },
    changePassword: async (body) => {
      await request('/auth/change-password', { method: 'POST', body })
    },
    updateProfile: body => request('/me', { method: 'PATCH', body }),
    getNotifications: () => request('/notifications'),
    markNotificationsRead: async (ids) => {
      await request('/notifications/read', { method: 'POST', body: { ids } })
    },
    getDashboard: () => request('/me/dashboard'),
    getInternship: () => request('/me/internship'),
    getDailyWorklogs: date => request('/me/worklogs/daily', { query: { date } }),
    listWorklogs: (from, to) => request('/me/worklogs', { query: { from, to } }),
    getWorklog: id => request(`/me/worklogs/${id}`),
    getWorklogFormContext: mode => request('/me/worklogs/form-context', { query: { mode } }),
    getServerTime: async () => (await request<{ now: string }>('/time')).now,

    saveWorklog: ({ id, newFiles, ...data }) => {
      // multipart: ฟิลด์ "data" เป็น JSON และ "files" เป็นไฟล์ใหม่
      const body = new FormData()
      body.append('data', JSON.stringify(data))
      for (const file of newFiles) body.append('files', file)
      return request(id ? `/me/worklogs/${id}` : '/me/worklogs', { method: id ? 'PUT' : 'POST', body })
    },

    startWorklog: id => request(`/me/worklogs/${id}/start`, { method: 'POST' }),
    finishWorklog: id => request(`/me/worklogs/${id}/finish`, { method: 'POST' }),

    deleteWorklog: async (id, reason) => {
      await request(`/me/worklogs/${id}`, { method: 'DELETE', body: { reason } })
    },

    getWorklogHistory: id => request(`/me/worklogs/${id}/history`),
    getMyWeeklyReport: weekStart => request('/me/reports/weekly', { query: { weekStart } }),
    getMentorStudents: () => request('/mentor/students'),
    getMentorWeeklyReports: (weekStart, studentId) => request('/mentor/reports/weekly', { query: { weekStart, studentId } }),
    getSupervisedStudents: () => request('/mentor/students/overview'),
    getReviewQueue: (filter, limit, studentId) => request('/mentor/reviews', { query: { filter, limit, studentId } }),
    approveWorklogs: (items, comment) => request('/mentor/reviews/approve', { method: 'POST', body: { items, comment } }),
    returnWorklogs: (items, comment, allowTimeEdit) => request('/mentor/reviews/return', { method: 'POST', body: { items, comment, allowTimeEdit } }),
    createUnavailability: async (body) => {
      await request('/mentor/unavailability', { method: 'POST', body })
    },
  }
}
