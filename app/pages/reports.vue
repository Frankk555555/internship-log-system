<script setup lang="ts">
definePageMeta({ role: 'student' })

const api = useApi()
const notify = useNotify()
const { view, date, period } = useReportPeriod()
const rangeKey = computed(() => `${period.value.from}|${period.value.to}`)

// นักศึกษาเห็นเฉพาะงานของตนเอง (ขอบเขตงานข้อ 2.3)
const { data, status, error, refresh } = await useLazyAsyncData(
  'my-report',
  async () => {
    const key = rangeKey.value
    return { key, report: await api.getMyReport(period.value.from, period.value.to) }
  },
  { watch: [rangeKey] },
)

// แสดงเฉพาะข้อมูลที่ตรงกับช่วงที่เลือก
const current = computed(() => data.value?.key === rangeKey.value ? data.value.report : undefined)
// ฉบับร่างเป็นงานของตนเอง จึงแสดงได้ แต่ไม่นับในชั่วโมงรวม
const report = computed(() => current.value && buildReport(current.value, period.value))

// ชื่อหน้าใช้เป็นชื่อไฟล์เริ่มต้นเวลาบันทึกเป็น PDF จึงไม่ต่อท้ายด้วยชื่อระบบ
useHead({
  title: () => `${period.value.name} ${current.value?.name ?? ''} ${period.value.label}`,
  titleTemplate: '%s',
})

function downloadExcel() {
  if (!report.value || !current.value) return
  try {
    downloadReportExcel({ reports: [report.value], period: period.value, fileKey: current.value.studentId })
    notify('success', 'ดาวน์โหลด Excel แล้ว', `${period.value.name} ${period.value.label}`)
  }
  catch {
    notify('error', 'ดาวน์โหลดไม่สำเร็จ', 'กรุณาลองอีกครั้ง')
  }
}
</script>

<template>
  <div>
    <PageHeader class="mb-4 print:hidden" title="รายงาน" :crumbs="[{ label: 'พื้นที่นักศึกษา' }, { label: 'รายงาน' }]">
      <div class="space-y-3">
        <ReportViewTabs v-model="view" />
        <div class="flex flex-wrap items-end justify-between gap-3">
          <PeriodSelector v-model="date" :view="view" />
          <ReportDownloadButtons :disabled="!report" @excel="downloadExcel" />
        </div>
      </div>
    </PageHeader>

    <AsyncState :loading="!report && status !== 'error'" :error="error" @retry="refresh()">
      <ReportCard v-if="report" own :report="report" :period="period" />
    </AsyncState>
  </div>
</template>
