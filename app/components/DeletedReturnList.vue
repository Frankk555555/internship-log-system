<script setup lang="ts">
import type { DeletedWorklog } from '~/types/review'

defineProps<{
  items: DeletedWorklog[]
}>()

function deletedLabel(value: string) {
  const { date, time } = toThaiTimeParts(value)
  return `${formatThaiDayMonth(date)} • ${time} น.`
}
</script>

<template>
  <section aria-labelledby="deleted-returns-title">
    <h3 id="deleted-returns-title" class="text-base font-bold text-slate-900">รายการที่ส่งกลับแล้วถูกลบ ({{ items.length }})</h3>
    <p class="mt-1 text-[11px] text-slate-500">นักศึกษาลบรายการที่คุณส่งกลับให้แก้ไข รายการเหล่านี้ไม่ถูกนับชั่วโมง</p>

    <div class="relative mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="w-full min-w-[860px] table-fixed border-collapse text-left">
        <thead>
          <tr class="bg-slate-50 text-[11px] font-semibold text-slate-500">
            <th class="w-[15%] px-3.5 py-3">นักศึกษา</th>
            <th class="w-[11%] px-2 py-3">วันที่</th>
            <th class="px-2 py-3">รายละเอียดงาน</th>
            <th class="w-[23%] px-2 py-3">ความเห็นที่ส่งกลับ</th>
            <th class="w-[20%] px-2 py-3">เหตุผลที่ลบ</th>
            <th class="w-[11%] px-2 py-3">ลบเมื่อ</th>
            <th class="w-[7%] px-2 py-3"><span class="sr-only">การดำเนินการ</span></th>
          </tr>
        </thead>
        <tbody class="text-xs text-slate-800">
          <tr v-for="item in items" :key="item.worklog.id" class="border-t border-slate-200 align-top">
            <td class="px-3.5 py-3.5">{{ item.studentName }}</td>
            <td class="whitespace-nowrap px-2 py-3.5">{{ formatThaiDate(item.worklog.date) }}</td>
            <td class="break-words px-2 py-3.5">
              {{ item.worklog.title }}
              <span v-if="item.worklog.startTime" class="mt-0.5 block text-[11px] text-slate-500">{{ item.worklog.startTime }}–{{ item.worklog.endTime }} น.</span>
            </td>
            <td class="break-words px-2 py-3.5">{{ item.worklog.reviewComment ?? '–' }}</td>
            <td class="break-words px-2 py-3.5">{{ item.worklog.deletion?.reason }}</td>
            <td class="px-2 py-3.5">{{ item.worklog.deletion ? deletedLabel(item.worklog.deletion.deletedAt) : '–' }}</td>
            <td class="px-2 py-3.5">
              <NuxtLink :to="`/worklogs/${item.worklog.id}/history`" class="text-[11px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800" :aria-label="`ดูประวัติ ${item.studentName} ${item.worklog.title}`">
                ประวัติ
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
