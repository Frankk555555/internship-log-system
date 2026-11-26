<script setup lang="ts">
import type { WorkLog } from '~/types/worklog'

// ฉบับร่างของวันอื่น ให้กลับมาแก้ไขหรือลบได้ (ขอบเขตงานข้อ 8.1, 8.4)
defineProps<{
  worklogs: WorkLog[]
}>()

defineEmits<{
  delete: [log: WorkLog]
}>()

function timeLabel(log: WorkLog) {
  if (!log.startTime) return 'ยังไม่เริ่ม'
  return log.endTime ? `${log.startTime}–${log.endTime} น.` : `${log.startTime} น. – กำลังทำ`
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="drafts-heading">
    <h3 id="drafts-heading" class="px-5 py-4 text-base font-semibold text-slate-800">ฉบับร่างของวันอื่น ({{ worklogs.length }})</h3>

    <ul>
      <li v-for="log in worklogs" :key="log.id" class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
        <div>
          <p class="text-[13px] font-semibold text-slate-800">
            {{ log.title }}
            <span class="ml-1 text-xs font-medium text-slate-500">{{ formatThaiDate(log.date) }} · {{ timeLabel(log) }}</span>
          </p>
          <p v-if="log.canEdit === false" class="mt-0.5 text-[11px] font-medium text-red-500">เกินช่วงย้อนหลังแล้ว แก้ไขไม่ได้</p>
        </div>

        <div class="flex gap-3 text-[11px] font-semibold underline underline-offset-2">
          <NuxtLink v-if="log.canEdit !== false" :to="`/worklogs/${log.id}/edit`" class="text-amber-600 hover:text-amber-700" :aria-label="`แก้ไข ${log.title}`">แก้ไข</NuxtLink>
          <button type="button" class="text-red-500 hover:text-red-600" :aria-label="`ลบ ${log.title}`" @click="$emit('delete', log)">ลบ</button>
        </div>
      </li>
    </ul>
  </section>
</template>
