<script setup lang="ts">
import type { WorkLog } from '~/types/worklog'

// รายการที่ถูกส่งกลับพร้อมความคิดเห็นของพี่เลี้ยง (ขอบเขตงานข้อ 8.3)
defineProps<{
  worklogs: WorkLog[]
}>()

function reviewedLabel(log: WorkLog) {
  if (!log.reviewedAt) return log.reviewedBy ?? ''
  const { date, time } = toThaiTimeParts(log.reviewedAt)
  return [log.reviewedBy, `${formatThaiDate(date)} ${time} น.`].filter(Boolean).join(' · ')
}
</script>

<template>
  <section class="rounded-xl border border-pink-200 bg-white shadow-sm" aria-labelledby="returned-heading">
    <h3 id="returned-heading" class="flex items-center gap-2 px-5 py-4 text-base font-semibold text-slate-800">
      <UIcon name="i-lucide-rotate-ccw" class="size-4 text-pink-600" />
      รายการที่ถูกส่งกลับแก้ไข ({{ worklogs.length }})
    </h3>

    <ul>
      <li v-for="log in worklogs" :key="log.id" class="border-t border-slate-100 px-5 py-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-[13px] font-semibold text-slate-800">
            {{ log.title }}
            <span class="ml-1 text-xs font-medium text-slate-500">
              {{ formatThaiDate(log.date) }}<template v-if="log.startTime && log.endTime"> · {{ log.startTime }}–{{ log.endTime }} น.</template>
            </span>
          </p>
          <div class="flex items-center gap-3">
            <NuxtLink :to="`/worklogs/${log.id}/history`" class="text-[11px] font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700" :aria-label="`ดูประวัติ ${log.title}`">
              ดูประวัติ
            </NuxtLink>
            <NuxtLink v-if="log.canEdit !== false" :to="`/worklogs/${log.id}/edit`" class="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-600" :aria-label="`แก้ไขและส่งตรวจใหม่ ${log.title}`">
              แก้ไข &amp; ส่งตรวจใหม่
            </NuxtLink>
          </div>
        </div>

        <blockquote class="mt-2 whitespace-pre-line rounded-lg bg-pink-50 px-3 py-2 text-xs text-slate-700">
          <span class="font-semibold text-pink-700">ความคิดเห็นของพี่เลี้ยง:</span>
          {{ log.reviewComment ?? 'ไม่ได้ระบุ' }}
        </blockquote>

        <div class="mt-1.5 flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
          <span>{{ reviewedLabel(log) }}</span>
          <span v-if="log.canEdit === false" class="font-medium text-red-500">เกินช่วงย้อนหลังแล้ว แก้ไขและส่งใหม่ไม่ได้</span>
        </div>
      </li>
    </ul>
  </section>
</template>
