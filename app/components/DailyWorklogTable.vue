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
  <section class="rounded-xl border border-slate-200 bg-white pb-5 shadow-sm">
    <h3 class="px-5 py-4 text-base font-bold text-slate-900">รายการงานในวันนี้</h3>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[680px] table-fixed border-collapse text-left">
        <thead>
          <tr class="bg-slate-50 text-[11px] font-semibold text-slate-500">
            <th class="w-[30%] px-5 py-3">หัวข้อ / {{ date }}</th>
            <th class="px-3 py-3">เวลาเริ่ม–สิ้นสุด</th>
            <th class="px-3 py-3">ความคืบหน้า</th>
            <th class="px-3 py-3">การตรวจสอบ</th>
            <th class="w-[130px] px-5 py-3"><span class="sr-only">การดำเนินการ</span></th>
          </tr>
        </thead>
        <tbody class="[&>tr]:border-b [&>tr]:border-slate-100">
          <tr v-for="log in logs" :key="log.id">
            <td class="px-5 py-3.5 text-[13px] font-semibold text-slate-800">{{ log.title }}</td>
            <td class="px-3 py-3.5 font-medium text-slate-500" :class="log.startTime ? 'text-xs' : 'text-[11px]'">{{ timeRange(log) }}</td>
            <td class="px-3 py-3.5">
              <StatusBadge v-bind="workStatusMeta[log.workStatus]" />
            </td>
            <td class="px-3 py-3.5">
              <StatusBadge v-bind="reviewStatusMeta[log.reviewStatus]" />
            </td>
            <td class="px-5 py-3.5">
              <div class="flex justify-end gap-3 text-[11px] font-semibold underline underline-offset-2">
                <NuxtLink v-if="log.reviewStatus === 'approved'" :to="`/worklogs/${log.id}/history`" class="text-slate-500 hover:text-slate-700">ดูประวัติ</NuxtLink>
                <NuxtLink v-if="deletableStatuses.includes(log.reviewStatus) && log.canEdit !== false" :to="`/worklogs/${log.id}/edit`" class="text-indigo-600 hover:text-indigo-700" :aria-label="`แก้ไข ${log.title}`">แก้ไข</NuxtLink>
                <button v-if="deletableStatuses.includes(log.reviewStatus)" type="button" class="text-red-600 hover:text-red-700" :aria-label="`ลบ ${log.title}`" @click="$emit('delete', log)">ลบ</button>
              </div>
            </td>
          </tr>
          <tr v-if="logs.length === 0">
            <td colspan="5" class="px-5 py-12 text-center text-sm text-slate-500">ยังไม่มีรายการงานในวันนี้</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
