<script setup lang="ts">
definePageMeta({ layout: 'mentor', role: 'supervisor' })

const api = useApi()
const notify = useNotify()
const user = useSessionUser()
const { data: students, error: studentsError, refresh: refreshStudents } = await useLazyAsyncData('mentor-students', () => api.getMentorStudents())

// ตัวเลือกสัปดาห์และนักศึกษา (ขอบเขตงานข้อ 12.1)
const allStudents = 'all'
// เปิดจากหน้านักศึกษาในความดูแลจะเลือกคนนั้นไว้ให้
const route = useRoute()
const linkedStudent = route.query.student ? String(route.query.student) : undefined
const pickedStudent = ref(linkedStudent)
const selectedStudent = computed({
  get: () => pickedStudent.value ?? students.value?.[0]?.studentId ?? allStudents,
  set: value => pickedStudent.value = value,
})

const pickedWeek = ref<string>()
const weekStart = computed({
  get: () => pickedWeek.value ?? startOfWeek(user.value?.defaultReportDate ?? toThaiTimeParts(new Date().toISOString()).date),
  set: value => pickedWeek.value = value,
})
const weekLabel = computed(() => formatWeekLabel(weekStart.value))
const selectionKey = computed(() => `${weekStart.value}|${selectedStudent.value}`)

const { data, status, error, refresh } = await useLazyAsyncData(
  'mentor-weekly-reports',
  async () => {
    const key = selectionKey.value
    const studentId = selectedStudent.value === allStudents ? undefined : selectedStudent.value
    return { key, reports: await api.getMentorWeeklyReports(weekStart.value, studentId) }
  },
  { watch: [selectionKey] },
)

// แสดงเฉพาะข้อมูลที่ตรงกับตัวเลือกปัจจุบัน
const reports = computed(() => data.value?.key === selectionKey.value
  ? data.value.reports.map(report => buildWeeklyReport(report, weekStart.value))
  : undefined)

const isAll = computed(() => selectedStudent.value === allStudents)
const allApprovedMinutes = computed(() => reports.value?.reduce((total, report) => total + report.approvedMinutes, 0) ?? 0)
const reportName = computed(() => isAll.value ? 'นักศึกษาทั้งหมด' : reports.value?.[0]?.name ?? '')

// ชื่อหน้าใช้เป็นชื่อไฟล์เริ่มต้นเวลาบันทึกเป็น PDF จึงไม่ต่อท้ายด้วยชื่อระบบ
useHead({
  title: () => `รายงานประจำสัปดาห์ ${reportName.value} ${formatThaiDate(weekStart.value)}`,
  titleTemplate: '%s',
})

function retry() {
  refreshStudents()
  refresh()
}

function downloadExcel() {
  if (!reports.value) return
  try {
    downloadWeeklyReportExcel({
      reports: reports.value,
      weekStart: weekStart.value,
      fileKey: selectedStudent.value,
      showOverallTotal: isAll.value,
    })
    notify('success', 'ดาวน์โหลด Excel แล้ว', `${reportName.value}\nสัปดาห์ ${weekLabel.value}`)
  }
  catch {
    notify('error', 'ดาวน์โหลดไม่สำเร็จ', 'กรุณาลองอีกครั้ง')
  }
}
</script>

<template>
  <div>
    <header class="mb-4 border-b border-slate-200 pb-3 print:hidden">
      <div class="flex items-start justify-between gap-4">
        <div>
          <BackButton v-if="linkedStudent" fallback="/mentor/students" class="mb-3" />
          <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-500" aria-label="breadcrumb">
            <span>พื้นที่พี่เลี้ยง</span>
            <span>/</span>
            <span class="text-slate-500">รายงานประจำสัปดาห์</span>
          </nav>
          <h2 class="mt-2 text-2xl font-bold text-slate-900">รายงานประจำสัปดาห์</h2>
        </div>
        <NotificationButton :count="user?.unreadNotifications" />
      </div>

      <div class="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
            นักศึกษา
            <select v-model="selectedStudent" :disabled="!students" class="h-9 min-w-56 rounded-lg border border-control bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:text-slate-400">
              <option :value="allStudents">นักศึกษาทั้งหมด{{ students ? ` (${students.length} คน)` : '' }}</option>
              <option v-for="student in students" :key="student.studentId" :value="student.studentId">
                {{ student.name }} ({{ student.studentId }})
              </option>
            </select>
          </label>
          <WeekSelector v-model="weekStart" />
        </div>

        <ReportDownloadButtons :disabled="!reports" @excel="downloadExcel" />
      </div>
    </header>

    <AsyncState :loading="!reports && status !== 'error'" :error="studentsError ?? error" @retry="retry">
      <div class="space-y-4">
        <!-- แต่ละคนขึ้นหน้าใหม่ในเอกสาร PDF -->
        <WeeklyReportCard
          v-for="(report, index) in reports"
          :key="report.studentId"
          :report="report"
          :week-label="weekLabel"
          :class="index > 0 ? 'print:break-before-page' : ''"
        />

        <div v-if="isAll" class="flex break-inside-avoid items-center justify-between gap-3 rounded-xl bg-indigo-600 px-5 py-4 text-white">
          <p class="text-xs font-semibold">ชั่วโมงรวมทุกคน (นับเฉพาะรายการที่อนุมัติแล้ว)</p>
          <p class="text-base font-bold">{{ formatHours(allApprovedMinutes) }} ชม.</p>
        </div>
      </div>
    </AsyncState>
  </div>
</template>
