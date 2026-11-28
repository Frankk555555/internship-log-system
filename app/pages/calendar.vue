<script setup lang="ts">
definePageMeta({ role: 'student' })
useHead({ title: 'ปฏิทินการทำงาน' })

type CalendarView = 'week' | 'day'

const api = useApi()
const route = useRoute()
const router = useRouter()

// มุมมองและวันที่อยู่ใน URL กดย้อนกลับจากหน้ารายการแล้วได้หน้าเดิม
const view = computed<CalendarView>(() => route.query.view === 'day' ? 'day' : 'week')
const picked = computed(() => {
  const value = String(route.query.date ?? '')
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined
})
const requestKey = computed(() => `${view.value}:${picked.value ?? ''}`)

// นักศึกษาเห็นเฉพาะงานของตนเอง (ขอบเขตงานข้อ 11.1)
const { data, status, error, refresh } = await useLazyAsyncData(
  'calendar',
  async () => {
    const key = requestKey.value
    const mode = view.value
    const chosen = picked.value
    const [now, internship] = await Promise.all([api.getServerTime(), api.getInternship()])
    const today = toThaiTimeParts(now).date
    const date = chosen ?? today

    if (mode === 'day') {
      const daily = await api.getDailyWorklogs(date)
      return { key, today, date, dates: [date], hours: internship, logs: daily.worklogs, unavailable: daily.mentorUnavailable }
    }

    const monday = startOfWeek(date)
    const dates = Array.from({ length: 7 }, (_, index) => addDays(monday, index))
    const logs = await api.listWorklogs(monday, dates[6]!)
    return { key, today, date, dates, hours: internship, logs, unavailable: undefined }
  },
  { watch: [requestKey] },
)

// แสดงเฉพาะข้อมูลที่ตรงกับมุมมองและวันที่เลือก
const current = computed(() => data.value?.key === requestKey.value ? data.value : undefined)
const clock = useServerClock()

const label = computed(() => {
  const shown = current.value
  if (!shown) return '...'
  return view.value === 'week'
    ? formatWeekLabel(shown.dates[0]!)
    : `${formatWeekday(shown.date)} ${formatThaiDate(shown.date)}`
})
const unit = computed(() => view.value === 'week' ? 'สัปดาห์' : 'วัน')

/** push = เก็บหน้าปัจจุบันไว้ให้กดย้อนกลับ ส่วนการเลื่อนวันหรือสลับแท็บไม่เก็บ */
function show(next: { view?: CalendarView, date?: string }, push = false) {
  const target = { view: view.value, date: picked.value, ...next }
  const location = { query: { view: target.view, ...(target.date ? { date: target.date } : {}) } }
  return push ? router.push(location) : router.replace(location)
}

// แสดงปุ่มย้อนกลับเมื่อเข้ามุมมองรายวันจากการกดหัวคอลัมน์
const canReturn = ref(false)
function updateCanReturn() {
  canReturn.value = view.value === 'day' && String(window.history.state?.back ?? '').startsWith('/calendar')
}
onMounted(updateCanReturn)
watch(() => route.fullPath, updateCanReturn)

function move(step: number) {
  const date = current.value?.date
  if (date) show({ date: addDays(date, step * (view.value === 'week' ? 7 : 1)) })
}

const tabs: { view: CalendarView, label: string }[] = [
  { view: 'week', label: 'รายสัปดาห์' },
  { view: 'day', label: 'รายวัน' },
]
</script>

<template>
  <div>
    <PageHeader class="mb-4" title="ปฏิทินการทำงาน" :crumbs="[{ label: 'พื้นที่นักศึกษา' }, { label: 'ปฏิทินการทำงาน' }]">
      <template v-if="canReturn" #back>
        <BackButton fallback="/calendar" />
      </template>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div class="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="มุมมองปฏิทิน">
          <button
            v-for="tab in tabs"
            :key="tab.view"
            type="button"
            :aria-pressed="view === tab.view"
            class="min-w-24 rounded-md border px-4 py-1.5 text-xs font-semibold"
            :class="view === tab.view ? 'border-brand bg-white text-brand shadow-sm' : 'border-transparent text-slate-600 hover:text-slate-800'"
            @click="show({ view: tab.view })"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="relative flex items-center gap-1">
          <button type="button" :disabled="!current" class="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-brand" :aria-label="`${unit}ก่อนหน้า`" @click="move(-1)">
            <UIcon name="i-lucide-chevron-left" class="size-4" />
          </button>
          <DatePicker align="center" :week="view === 'week'" :value="current?.date" label="เลือกวันที่" @pick="date => show({ date })">
            <button type="button" :disabled="!current" class="min-w-44 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink hover:bg-slate-100" title="เลือกวันที่">
              <span aria-live="polite">{{ label }}</span>
            </button>
          </DatePicker>
          <button type="button" :disabled="!current" class="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-brand" :aria-label="`${unit}ถัดไป`" @click="move(1)">
            <UIcon name="i-lucide-chevron-right" class="size-4" />
          </button>
        </div>

        <button type="button" class="btn btn-secondary px-3 py-1.5 text-xs" @click="show({ date: undefined })">
          วันนี้
        </button>
      </div>
    </PageHeader>

    <AsyncState :loading="!current && status !== 'error'" :error="error" @retry="refresh()">
      <template v-if="current">
        <div v-if="view === 'day'" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
          <CalendarGrid :dates="current.dates" :logs="current.logs" :hours="current.hours" :today="current.today" :now="clock?.time" detailed />
          <CalendarDayPanel :date="current.date" :today="current.today" :logs="current.logs" :unavailable="current.unavailable" />
        </div>

        <CalendarGrid
          v-else
          :dates="current.dates"
          :logs="current.logs"
          :hours="current.hours"
          :today="current.today"
          :now="clock?.time"
          @select-date="date => show({ view: 'day', date }, true)"
        />
      </template>
    </AsyncState>

    <ul class="mt-4 flex flex-wrap gap-2" aria-label="ความหมายของสี">
      <li v-for="(meta, key) in calendarStatusMeta" :key="key" class="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-2xs font-semibold" :class="[meta.chip, meta.text]">
        <UIcon :name="meta.icon" class="size-3.5" />
        {{ meta.label }}
      </li>
    </ul>
  </div>
</template>
