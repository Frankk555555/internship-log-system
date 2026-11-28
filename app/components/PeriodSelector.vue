<script setup lang="ts">
import type { ReportView } from '~/utils/report'

const props = defineProps<{
  view: ReportView
}>()

/** วันที่ "YYYY-MM-DD" ช่วงที่แสดงคือวัน สัปดาห์ หรือปีของวันนี้ */
const date = defineModel<string>({ required: true })

const period = computed(() => reportPeriod(props.view, date.value))
const unit = computed(() => ({ day: 'วัน', week: 'สัปดาห์', year: 'ปี' })[props.view])
const title = computed(() => ({ day: 'วันที่', week: 'สัปดาห์ (จันทร์–อาทิตย์)', year: 'ปี พ.ศ.' })[props.view])

const move = (step: number) => date.value = shiftReportDate(props.view, date.value, step)

const year = computed({
  get: () => Number(date.value.slice(0, 4)),
  set: value => date.value = shiftReportDate('year', date.value, value - Number(date.value.slice(0, 4))),
})
/** ปีให้เลือก: ย้อนหลังและล่วงหน้าจากปีปัจจุบัน และครอบคลุมปีที่ดูอยู่ */
const years = computed(() => {
  const now = Number(toThaiTimeParts(new Date().toISOString()).date.slice(0, 4))
  const from = Math.min(now - 5, year.value)
  const to = Math.max(now + 1, year.value)
  return Array.from({ length: to - from + 1 }, (_, index) => to - index)
})

const arrowClass = 'flex h-full items-center px-2 text-ink-muted hover:text-brand'
</script>

<template>
  <div class="flex flex-col gap-1">
    <span id="period-label" class="text-2xs font-semibold text-slate-600">{{ title }}</span>
    <div role="group" aria-labelledby="period-label" class="flex h-9 items-center rounded-lg border border-line bg-white">
      <button type="button" :class="arrowClass" :aria-label="`${unit}ก่อนหน้า`" @click="move(-1)">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
      </button>

      <select v-if="view === 'year'" v-model="year" class="h-full min-w-44 cursor-pointer border-x border-line bg-white px-3 text-xs font-medium tabular-nums text-slate-800" aria-label="เลือกปี พ.ศ.">
        <option v-for="option in years" :key="option" :value="option">พ.ศ. {{ option + 543 }}</option>
      </select>
      <!-- โหมดสัปดาห์เลือกวันใดก็ได้ จะแสดงสัปดาห์ของวันนั้น -->
      <DatePicker v-else align="center" :week="view === 'week'" :value="view === 'week' ? period.from : date" :label="`เลือก${unit}`" @pick="value => date = value">
        <button type="button" class="flex h-full min-w-44 items-center justify-center gap-2 border-x border-line px-3 text-xs font-medium text-slate-800 hover:bg-page" :aria-label="`เลือก${unit}จากปฏิทิน`">
          <UIcon name="i-lucide-calendar" class="size-4" />
          <span aria-live="polite">{{ period.label }}</span>
        </button>
      </DatePicker>

      <button type="button" :class="arrowClass" :aria-label="`${unit}ถัดไป`" @click="move(1)">
        <UIcon name="i-lucide-chevron-right" class="size-4" />
      </button>
    </div>
  </div>
</template>
