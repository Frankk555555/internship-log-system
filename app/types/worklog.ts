export type UserRole = 'student' | 'supervisor' | 'admin'

export type WorkStatus = 'not_started' | 'in_progress' | 'completed'

export type ReviewStatus = 'draft' | 'returned' | 'approved'

export interface UserProfile {
  name: string
  studentId: string
  role: UserRole
}

export interface InternshipInfo {
  company: string
  progress: number
  startDate: string
  endDate: string
}

export interface WorkLog {
  id: number
  date: string
  title: string
  description: string
  startTime?: string
  endTime?: string
  workStatus: WorkStatus
  reviewStatus: ReviewStatus
}
