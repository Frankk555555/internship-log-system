<script setup lang="ts">
import type { WorkHours, WorkLog } from '~/types/worklog'
import type { CalendarBlock } from '~/utils/calendar'

const props = defineProps<{
  /** วันที่แต่ละคอลัมน์ */
  dates: string[]
  logs: WorkLog[]
  hours: WorkHours
  today: string
  /** เวลาเซิร์ฟเวอร์ "HH:MM" ใช้ยืดช่องของงานที่กำลังทำ */
  now?: string
  /** มุมมองรายวัน: ไม่มีหัวตาราง และแสดงรายละเอียดในช่อง */
  detailed?: boolean
}>()

defineEmits<{
  selectDate: [date: string]
}>()

const HOUR_HEIGHT = 56

const range = computed(() => calendarHourRange(props.logs, props.hours))
const hourLabels = computed(() => Array.from(
  { length: range.value.lastHour - range.value.firstHour },
  (_, index) => `${String(range.value.firstHour + index).padStart(2, '0')}:00`,
))

const columns = computed(() => props.dates.map((date) => {
  const logs = props.logs.filter(log => log.date === date)
  const runningUntil = date === props.today && props.now
    ? Math.min(toMinutes(props.now), toMinutes(props.hours.workEndTime))
    : undefined

  return {
    date,
    isWeekend: isWeekend(date),
    blocks: calendarBlocks(logs, runningUntil),
    untimed: logs.filter(log => !log.startTime),
  }
}))

// มุมมองรายวันแสดงรายการไม่มีเวลาในแผงด้านข้าง
const hasUntimed = computed(() => !props.detailed && columns.value.some(column => column.untimed.length))
const gridStyle = computed(() => ({ gridTemplateColumns: `4rem repeat(${props.dates.length}, minmax(0, 1fr))` }))

function blockStyle({ start, end, lane, lanes }: CalendarBlock) {
  return {
    top: `${(start - range.value.firstHour * 60) / 60 * HOUR_HEIGHT + 2}px`,
    height: `${(end - start) / 60 * HOUR_HEIGHT - 4}px`,
    left: `calc(${lane / lanes * 100}% + 4px)`,
    width: `calc(${100 / lanes}% - 8px)`,
  }
}
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <div :class="detailed ? '' : 'min-w-[720px]'">
      <div v-if="!detailed" class="grid border-b border-slate-200" :style="gridStyle">
        <div />
        <button
          v-for="column in columns"
          :key="column.date"
          type="button"
          class="border-l border-slate-200 py-3 text-center text-xs font-semibold hover:text-indigo-600"
          :class="[column.isWeekend ? 'bg-slate-100 text-slate-500' : 'text-slate-900', column.date === today ? '!text-indigo-600 underline decoration-2 underline-offset-4' : '']"
          :aria-label="`ดูรายวัน ${formatCalendarDay(column.date)}${column.date === today ? ' (วันนี้)' : ''}`"
          @click="$emit('selectDate', column.date)"
        >
          {{ formatCalendarDay(column.date) }}
        </button>
      </div>

      <div v-if="hasUntimed" class="grid border-b border-slate-200" :style="gridStyle">
        <div class="px-2 py-2 text-[10px] text-slate-500">ไม่มีเวลา</div>
        <div v-for="column in columns" :key="column.date" class="space-y-1 border-l border-slate-200 p-1" :class="column.isWeekend ? 'bg-slate-100' : ''">
          <NuxtLink
            v-for="log in column.untimed"
            :key="log.id"
            :to="calendarLink(log)"
            :title="`${log.title} · ${calendarStatusMeta[log.reviewStatus].label}`"
            class="block truncate rounded border-l-4 px-1.5 py-1 text-[10px] font-semibold hover:brightness-95"
            :class="[calendarStatusMeta[log.reviewStatus].block, calendarStatusMeta[log.reviewStatus].text]"
          >
            {{ log.title }}
          </NuxtLink>
        </div>
      </div>

      <div class="grid" :style="gridStyle">
        <div aria-hidden="true">
          <div v-for="label in hourLabels" :key="label" class="border-b border-slate-200 px-3 pt-1 text-[11px] text-slate-500 last:border-b-0" :style="{ height: `${HOUR_HEIGHT}px` }">
            {{ label }}
          </div>
        </div>

        <div v-for="column in columns" :key="column.date" class="relative border-l border-slate-200" :class="column.isWeekend ? 'bg-slate-100' : ''">
          <div v-for="label in hourLabels" :key="label" aria-hidden="true" class="border-b border-slate-200 last:border-b-0" :style="{ height: `${HOUR_HEIGHT}px` }" />

          <NuxtLink
            v-for="block in column.blocks"
            :key="block.log.id"
            :to="calendarLink(block.log)"
            :style="blockStyle(block)"
            :title="`${block.log.title} · ${calendarTimeLabel(block.log, today)} · ${calendarStatusMeta[block.log.reviewStatus].label}`"
            class="absolute flex flex-col overflow-hidden rounded-md border-l-4 px-2 py-1 hover:brightness-95"
            :class="[calendarStatusMeta[block.log.reviewStatus].block, block.log.endTime ? '' : 'border-dashed']"
          >
            <span class="shrink-0 text-[11px] font-semibold leading-tight" :class="[calendarStatusMeta[block.log.reviewStatus].text, block.end - block.start < 75 ? 'truncate' : 'line-clamp-2']">
              {{ block.log.title }}
            </span>
            <span class="shrink-0 text-[10px] text-slate-500">
              {{ calendarTimeLabel(block.log, today) }}
              <template v-if="detailed && block.log.endTime"> · {{ formatDuration(toMinutes(block.log.endTime) - toMinutes(block.log.startTime!)) }}</template>
            </span>
            <template v-if="detailed">
              <span class="sr-only">{{ calendarStatusMeta[block.log.reviewStatus].label }}</span>
              <span v-if="block.log.description" class="mt-1 whitespace-pre-line text-[11px] leading-snug text-slate-600">{{ block.log.description }}</span>
            </template>
            <span v-else class="sr-only">{{ calendarStatusMeta[block.log.reviewStatus].label }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
