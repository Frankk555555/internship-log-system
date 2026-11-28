<script setup lang="ts">
import type { MentorAway, ReviewStatus, WorkLog } from '~/types/worklog'

const props = defineProps<{
  date: string
  today: string
  logs: WorkLog[]
  /** ช่วงที่พี่เลี้ยงไม่อยู่หรือไม่สะดวกตรวจงานในวันนั้น */
  unavailable?: MentorAway
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
    <section class="rounded-xl border border-line bg-white p-4">
      <h2 class="text-base font-bold text-ink">สรุปของวัน</h2>

      <dl class="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt class="text-2xs text-ink-muted">ชั่วโมงทั้งหมด</dt>
          <dd class="mt-0.5 text-sm font-semibold text-ink">{{ formatDuration(totalMinutes) }}</dd>
        </div>
        <div>
          <dt class="text-2xs text-ink-muted">อนุมัติแล้ว</dt>
          <dd class="mt-0.5 text-sm font-semibold text-done">{{ formatDuration(approvedMinutes) }}</dd>
        </div>
      </dl>

      <ul v-if="logs.length" class="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
        <li v-for="item in statuses" :key="item.status" class="flex items-center justify-between text-2xs">
          <StatusBadge v-bind="reviewStatusMeta[item.status]" />
          <span class="font-semibold text-slate-700">{{ item.count }} รายการ</span>
        </li>
      </ul>
      <p v-else class="mt-3 border-t border-slate-100 pt-3 text-xs text-ink-muted">ไม่มีรายการในวันนี้</p>

      <NuxtLink v-if="date === today" to="/worklogs/new" class="btn btn-primary mt-3 flex px-3 py-2 text-2xs">
        <UIcon name="i-lucide-plus" class="size-3.5" />
        สร้างรายการงานใหม่
      </NuxtLink>
    </section>

    <section v-if="untimed.length" class="rounded-xl border border-line bg-white p-4">
      <h2 class="text-base font-bold text-ink">ยังไม่ได้กำหนดเวลา</h2>
      <ul class="mt-2 space-y-2">
        <li v-for="log in untimed" :key="log.id">
          <NuxtLink :to="calendarLink(log)" class="block rounded-md border-l-4 px-2.5 py-2 hover:brightness-95" :class="calendarStatusMeta[log.reviewStatus].block">
            <span class="block text-2xs font-semibold" :class="calendarStatusMeta[log.reviewStatus].blockText">{{ log.title }}</span>
            <span class="block text-2xs" :class="calendarStatusMeta[log.reviewStatus].blockText">{{ workStatusMeta[log.workStatus].label }} · {{ calendarStatusMeta[log.reviewStatus].label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="unavailable" class="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 class="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <UIcon name="i-lucide-clock" class="size-3.5" />
        {{ mentorAwayLabel(unavailable).title }}
      </h2>
      <p class="mt-1 text-xs text-amber-800">{{ mentorAwayLabel(unavailable).time }}</p>
    </section>
  </aside>
</template>
