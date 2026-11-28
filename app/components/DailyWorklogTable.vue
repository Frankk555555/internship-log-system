<script setup lang="ts">
import type { ReviewStatus, WorkLog } from '~/types/worklog'

defineProps<{
  date: string
  logs: WorkLog[]
}>()

defineEmits<{
  delete: [log: WorkLog]
}>()

// แก้ไข/ลบได้เฉพาะฉบับร่างหรือถูกส่งกลับ (ขอบเขตงานข้อ 8.4)
const deletableStatuses: ReviewStatus[] = ['draft', 'returned']

function timeRange(log: WorkLog) {
  if (!log.startTime) return 'ยังไม่เริ่ม'
  if (!log.endTime) return `${log.startTime} – กำลังทำ...`
  return `${log.startTime} – ${log.endTime} น.`
}
</script>

<template>
  <section class="rounded-xl border border-line bg-white pb-5 shadow-sm">
    <h2 class="px-5 py-4 text-base font-bold text-ink">รายการงานในวันนี้</h2>

    <!-- relative: ข้อความสำหรับโปรแกรมอ่านหน้าจอในตารางไม่ดันหน้าให้กว้างเกิน -->
    <div class="relative overflow-x-auto">
      <table class="w-full min-w-[42.5rem] table-fixed border-collapse text-left">
        <thead>
          <tr class="bg-page text-2xs font-semibold text-ink-muted">
            <th class="w-[30%] px-5 py-3">หัวข้อ / {{ date }}</th>
            <th class="px-3 py-3">เวลาเริ่ม–สิ้นสุด</th>
            <th class="px-3 py-3">ความคืบหน้า</th>
            <th class="px-3 py-3">การตรวจสอบ</th>
            <th class="w-[8.125rem] px-5 py-3"><span class="sr-only">การดำเนินการ</span></th>
          </tr>
        </thead>
        <tbody class="[&>tr]:border-b [&>tr]:border-slate-100">
          <tr v-for="log in logs" :key="log.id">
            <td class="px-5 py-3.5 text-[0.8125rem] font-semibold text-slate-800">{{ log.title }}</td>
            <td class="px-3 py-3.5 font-medium text-ink-muted" :class="log.startTime ? 'text-xs' : 'text-2xs'">{{ timeRange(log) }}</td>
            <td class="px-3 py-3.5">
              <StatusBadge v-bind="workStatusMeta[log.workStatus]" />
            </td>
            <td class="px-3 py-3.5">
              <StatusBadge v-bind="reviewStatusMeta[log.reviewStatus]" />
            </td>
            <td class="px-5 py-3.5">
              <div class="flex justify-end gap-3 text-2xs font-semibold underline underline-offset-2">
                <NuxtLink v-if="log.reviewStatus === 'approved'" :to="`/worklogs/${log.id}/history`" class="text-ink-muted hover:text-slate-700">ดูประวัติ</NuxtLink>
                <NuxtLink v-if="deletableStatuses.includes(log.reviewStatus) && log.canEdit !== false" :to="`/worklogs/${log.id}/edit`" class="text-brand hover:text-brand-hover" :aria-label="`แก้ไข ${log.title}`">แก้ไข</NuxtLink>
                <button v-if="deletableStatuses.includes(log.reviewStatus)" type="button" class="text-danger hover:text-danger-hover" :aria-label="`ลบ ${log.title}`" @click="$emit('delete', log)">ลบ</button>
              </div>
            </td>
          </tr>
          <tr v-if="logs.length === 0">
            <td colspan="5" class="px-5 py-12 text-center text-sm text-ink-muted">ยังไม่มีรายการงานในวันนี้</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
