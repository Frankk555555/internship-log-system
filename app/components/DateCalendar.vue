<script setup lang="ts">
// ปฏิทินเลือกวันที่เป็นปี พ.ศ. ปฏิทินของเบราว์เซอร์แสดงปีตามภาษาของเครื่อง จึงทำเอง
// ภายในคิดเป็น "YYYY-MM-DD" (ค.ศ.) แสดงผลเป็น พ.ศ.
const props = defineProps<{
  /** วันที่เลือกอยู่ ไม่มีค่าเมื่อยังไม่ได้เลือกหรือพิมพ์ผิดรูปแบบ */
  value?: string
  label: string
  /** เลือกเป็นสัปดาห์ จันทร์–อาทิตย์ */
  week?: boolean
}>()

const emit = defineEmits<{
  pick: [date: string]
}>()

const weekdays = [
  { short: 'จ.', long: 'วันจันทร์' }, { short: 'อ.', long: 'วันอังคาร' }, { short: 'พ.', long: 'วันพุธ' },
  { short: 'พฤ.', long: 'วันพฤหัสบดี' }, { short: 'ศ.', long: 'วันศุกร์' }, { short: 'ส.', long: 'วันเสาร์' }, { short: 'อา.', long: 'วันอาทิตย์' },
]
const monthFormat = new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'UTC' })
const months = Array.from({ length: 12 }, (_, index) => monthFormat.format(new Date(Date.UTC(2026, index, 1))))
const fullFormat = new Intl.DateTimeFormat('th-TH-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** เช่น "วันเสาร์ที่ 28 พฤศจิกายน 2569" สำหรับโปรแกรมอ่านหน้าจอ */
const fullLabel = (date: string) => `${fullFormat.format(new Date(`${date}T00:00:00Z`))} ${Number(date.slice(0, 4)) + 543}`

const today = toThaiTimeParts(new Date().toISOString()).date

/** วันที่รับโฟกัสของแป้นพิมพ์ เดือนที่แสดงคือเดือนของวันนี้ */
const focused = ref(props.value ?? today)
const year = computed(() => Number(focused.value.slice(0, 4)))
const month = computed(() => Number(focused.value.slice(5, 7)) - 1)

/** 6 สัปดาห์เสมอ ความสูงของปฏิทินจึงคงที่ */
const weeks = computed(() => {
  const start = startOfWeek(`${focused.value.slice(0, 7)}-01`)
  return Array.from({ length: 6 }, (_, row) => Array.from({ length: 7 }, (_, column) => addDays(start, row * 7 + column)))
})

/** ปีให้เลือกรอบปีปัจจุบัน และครอบคลุมปีของค่าที่ดูอยู่ */
const years = computed(() => {
  const now = Number(today.slice(0, 4))
  const from = Math.min(now - 10, year.value)
  const to = Math.max(now + 10, year.value)
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
})

/** ย้ายไปเดือนที่กำหนด คงวันที่เดิมถ้าเดือนนั้นมี ไม่มีใช้วันสิ้นเดือน */
function goTo(targetYear: number, targetMonth: number) {
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const day = Math.min(Number(focused.value.slice(8, 10)), lastDay)
  focused.value = new Date(Date.UTC(targetYear, targetMonth, day)).toISOString().slice(0, 10)
}

const selectedWeek = computed(() => props.week && props.value ? startOfWeek(props.value) : undefined)
const isSelected = (date: string) => props.week ? startOfWeek(date) === selectedWeek.value : date === props.value

const grid = useTemplateRef<HTMLElement>('grid')
const focusDay = () => grid.value?.querySelector<HTMLElement>(`[data-date="${focused.value}"]`)?.focus({ preventScroll: true })
defineExpose({ focusDay })

async function onKey(event: KeyboardEvent) {
  const days: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  const weekStart = startOfWeek(focused.value)

  if (event.key in days) focused.value = addDays(focused.value, days[event.key]!)
  else if (event.key === 'Home') focused.value = weekStart
  else if (event.key === 'End') focused.value = addDays(weekStart, 6)
  else if (event.key === 'PageUp' || event.key === 'PageDown') {
    const step = event.key === 'PageUp' ? -1 : 1
    if (event.shiftKey) goTo(year.value + step, month.value)
    else goTo(year.value, month.value + step)
  }
  else return

  event.preventDefault()
  await nextTick()
  focusDay()
}

const arrowClass = 'flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-page hover:text-brand'
</script>

<template>
  <div class="w-[17.25rem] p-3" role="group" :aria-label="label">
    <div class="flex items-center gap-1">
      <button type="button" :class="arrowClass" aria-label="เดือนก่อนหน้า" @click="goTo(year, month - 1)">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
      </button>
      <select class="field h-9 min-w-0 flex-1 bg-white px-1 text-xs" aria-label="เดือน" :value="month" @change="goTo(year, Number(($event.target as HTMLSelectElement).value))">
        <option v-for="(name, index) in months" :key="name" :value="index">{{ name }}</option>
      </select>
      <select class="field h-9 w-[4.5rem] bg-white px-1 text-xs tabular-nums" aria-label="ปี พ.ศ." :value="year" @change="goTo(Number(($event.target as HTMLSelectElement).value), month)">
        <option v-for="option in years" :key="option" :value="option">{{ option + 543 }}</option>
      </select>
      <button type="button" :class="arrowClass" aria-label="เดือนถัดไป" @click="goTo(year, month + 1)">
        <UIcon name="i-lucide-chevron-right" class="size-4" />
      </button>
    </div>

    <table ref="grid" class="mt-2 w-full table-fixed border-collapse text-center" role="grid" :aria-label="`${months[month]} ${year + 543}`" @keydown="onKey">
      <thead>
        <tr>
          <th v-for="day in weekdays" :key="day.short" scope="col" class="py-1 text-2xs font-semibold text-slate-600" :abbr="day.long">{{ day.short }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in weeks" :key="row[0]">
          <td v-for="date in row" :key="date" role="gridcell" :aria-selected="isSelected(date)" class="p-0" :class="week && isSelected(date) ? 'bg-indigo-100 first:rounded-l-md last:rounded-r-md' : ''">
            <button
              type="button"
              class="mx-auto flex size-9 items-center justify-center rounded-md text-xs tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
              :class="[
                !week && isSelected(date) ? 'bg-brand font-semibold text-white' : Number(date.slice(5, 7)) - 1 === month ? 'text-slate-800 hover:bg-page' : 'text-ink-muted hover:bg-page',
                week && isSelected(date) ? 'font-semibold text-brand' : '',
                date === today ? 'ring-1 ring-inset ring-brand' : '',
              ]"
              :data-date="date"
              :tabindex="date === focused ? 0 : -1"
              :aria-label="fullLabel(date)"
              :aria-current="date === today ? 'date' : undefined"
              @click="emit('pick', date)"
            >
              {{ Number(date.slice(8, 10)) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="mt-2 flex items-center justify-between gap-3">
      <p class="text-2xs tabular-nums text-slate-600">{{ value ? (week ? formatWeekLabel(startOfWeek(value)) : formatThaiDate(value)) : 'ยังไม่ได้เลือก' }}</p>
      <button type="button" class="btn btn-secondary min-h-8 px-3 text-2xs" @click="emit('pick', today)">{{ week ? 'สัปดาห์นี้' : 'วันนี้' }}</button>
    </div>
  </div>
</template>
