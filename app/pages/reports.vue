<script setup lang="ts">
definePageMeta({ role: 'student' })

const api = useApi()
const notify = useNotify()
const user = useSessionUser()

// เริ่มที่สัปดาห์ปัจจุบัน จนกว่าผู้ใช้จะเลือกสัปดาห์เอง
const pickedWeek = ref<string>()
const weekStart = computed({
  get: () => pickedWeek.value ?? startOfWeek(user.value?.defaultReportDate ?? toThaiTimeParts(new Date().toISOString()).date),
  set: value => pickedWeek.value = value,
})
const weekLabel = computed(() => formatWeekLabel(weekStart.value))

// นักศึกษาเห็นเฉพาะงานของตนเอง (ขอบเขตงานข้อ 2.3)
const { data, status, error, refresh } = await useLazyAsyncData(
  'my-weekly-report',
  async () => {
    const week = weekStart.value
    return { week, report: await api.getMyWeeklyReport(week) }
  },
  { watch: [weekStart] },
)

// แสดงเฉพาะข้อมูลที่ตรงกับสัปดาห์ที่เลือก
const current = computed(() => data.value?.week === weekStart.value ? data.value.report : undefined)
// ฉบับร่างเป็นงานของตนเอง จึงแสดงได้ แต่ไม่นับในชั่วโมงรวม
const report = computed(() => current.value && buildWeeklyReport(current.value, weekStart.value))

// ชื่อหน้าใช้เป็นชื่อไฟล์เริ่มต้นเวลาบันทึกเป็น PDF จึงไม่ต่อท้ายด้วยชื่อระบบ
useHead({
  title: () => `รายงานประจำสัปดาห์ ${current.value?.name ?? ''} ${formatThaiDate(weekStart.value)}`,
  titleTemplate: '%s',
})

function downloadExcel() {
  if (!report.value || !current.value) return
  try {
    downloadWeeklyReportExcel({
      reports: [report.value],
      weekStart: weekStart.value,
      fileKey: current.value.studentId,
    })
    notify('success', 'ดาวน์โหลด Excel แล้ว', `รายงานสัปดาห์ ${weekLabel.value}`)
  }
  catch {
    notify('error', 'ดาวน์โหลดไม่สำเร็จ', 'กรุณาลองอีกครั้ง')
  }
}
</script>

<template>
  <div>
    <header class="mb-4 border-b border-slate-200 pb-3 print:hidden">
      <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-500" aria-label="breadcrumb">
        <span>พื้นที่นักศึกษา</span>
        <span>/</span>
        <span class="text-slate-500">รายงานประจำสัปดาห์</span>
      </nav>
      <h2 class="mt-2 text-2xl font-bold text-slate-900">รายงานประจำสัปดาห์</h2>

      <div class="mt-3 flex flex-wrap items-end justify-between gap-3">
        <WeekSelector v-model="weekStart" />
        <ReportDownloadButtons :disabled="!report" @excel="downloadExcel" />
      </div>
    </header>

    <AsyncState :loading="!report && status !== 'error'" :error="error" @retry="refresh()">
      <WeeklyReportCard v-if="report" :report="report" :week-label="weekLabel" />
    </AsyncState>
  </div>
</template>
