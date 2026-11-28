import type { ReportView } from '~/utils/report'

/** ชนิดรายงาน (?view=day|year ไม่ระบุ = สัปดาห์) และวันที่ที่เลือก สลับชนิดแล้วยังอยู่ช่วงของวันเดิม */
export function useReportPeriod() {
  const route = useRoute()
  const router = useRouter()
  const user = useSessionUser()

  const view = computed<ReportView>({
    get: () => route.query.view === 'day' || route.query.view === 'year' ? route.query.view : 'week',
    set: value => router.replace({ query: { ...route.query, view: value === 'week' ? undefined : value } }),
  })

  // เริ่มที่วันนี้ จนกว่าผู้ใช้จะเลือกเอง
  const picked = ref<string>()
  const date = computed({
    get: () => picked.value ?? user.value?.defaultReportDate ?? toThaiTimeParts(new Date().toISOString()).date,
    set: value => picked.value = value,
  })

  const period = computed(() => reportPeriod(view.value, date.value))

  return { view, date, period }
}
