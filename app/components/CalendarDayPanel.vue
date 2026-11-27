<script setup lang="ts">
import type { ReviewStatus, WorkLog } from '~/types/worklog'

const props = defineProps<{
  date: string
  today: string
  logs: WorkLog[]
  /** ช่วงเวลาที่พี่เลี้ยงไม่สะดวกตรวจงานในวันนั้น */
  unavailable?: { startTime: string, endTime: string }
}>()

const minutesOf = (logs: WorkLog[]) => logs.reduce(
  (total, log) => log.startTime && log.endTime ? total + toMinutes(log.endTime) - toMinutes(log.startTime) : total,
  0,
)

const totalMinutes = computed(() => minutesOf(props.logs))
// ชั่วโมงที่นับจริงในรายงานคือรายการที่อนุมัติแล้ว (ขอบเขตงานข้อ 12.3)
const approvedMinutes = computed(() => minutesOf(props.logs.filter(log => log.reviewStatus === 'approved')))
const untimed = computed(() => props.logs.filter(log => !log.startTime))
const statuses = computed(() => (Object.keys(calendarStatusMeta) as ReviewStatus[]).map(status => ({
  status,
  ...calendarStatusMeta[status],
  count: props.logs.filter(log => log.reviewStatus === status).length,
})))
</script>

<template>
  <aside class="space-y-3">
    <section class="rounded-xl border border-slate-200 bg-white p-4">
      <h3 class="text-base font-bold text-slate-900">สรุปของวัน</h3>

      <dl class="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt class="text-[11px] text-slate-500">ชั่วโมงทั้งหมด</dt>
          <dd class="mt-0.5 text-sm font-semibold text-slate-900">{{ formatDuration(totalMinutes) }}</dd>
        </div>
        <div>
          <dt class="text-[11px] text-slate-500">อนุมัติแล้ว</dt>
          <dd class="mt-0.5 text-sm font-semibold text-done">{{ formatDuration(approvedMinutes) }}</dd>
        </div>
      </dl>

      <ul v-if="logs.length" class="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
        <li v-for="item in statuses" :key="item.status" class="flex items-center justify-between text-[11px]">
          <StatusBadge v-bind="reviewStatusMeta[item.status]" />
          <span class="font-semibold text-slate-700">{{ item.count }} รายการ</span>
        </li>
      </ul>
      <p v-else class="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">ไม่มีรายการในวันนี้</p>

      <NuxtLink v-if="date === today" to="/worklogs/new" class="btn btn-primary mt-3 flex px-3 py-2 text-[11px]">
        <UIcon name="i-lucide-plus" class="size-3.5" />
        สร้างรายการงานใหม่
      </NuxtLink>
    </section>

    <section v-if="untimed.length" class="rounded-xl border border-slate-200 bg-white p-4">
      <h3 class="text-base font-bold text-slate-900">ยังไม่ได้กำหนดเวลา</h3>
      <ul class="mt-2 space-y-2">
        <li v-for="log in untimed" :key="log.id">
          <NuxtLink :to="calendarLink(log)" class="block rounded-md border-l-4 px-2.5 py-2 hover:brightness-95" :class="calendarStatusMeta[log.reviewStatus].block">
            <span class="block text-[11px] font-semibold" :class="calendarStatusMeta[log.reviewStatus].text">{{ log.title }}</span>
            <span class="block text-[10px] text-slate-500">{{ workStatusMeta[log.workStatus].label }} · {{ calendarStatusMeta[log.reviewStatus].label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="unavailable" class="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 class="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <UIcon name="i-lucide-clock" class="size-3.5" />
        พี่เลี้ยงไม่สะดวกตรวจงาน
      </h3>
      <p class="mt-1 text-xs text-amber-800">{{ unavailable.startTime }}–{{ unavailable.endTime }} น.</p>
    </section>
  </aside>
</template>
