<script setup lang="ts">
import type { InternshipInfo } from '~/types/worklog'

defineProps<{
  internship: InternshipInfo
}>()
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm lg:col-span-2">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-medium text-slate-500">สถานที่ฝึกงาน</p>
        <h3 class="mt-1 text-base font-bold text-slate-900">{{ internship.company }}</h3>
      </div>
      <span class="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600">
        {{ internship.progress }}% ของระยะเวลาฝึก
      </span>
    </div>

    <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
      <div class="h-full rounded-full bg-brand" :style="{ width: `${internship.progress}%` }" />
    </div>

    <div class="mt-1 flex flex-col gap-1 text-[11px] font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>วันที่เริ่มการฝึกงาน: {{ formatThaiDate(internship.startDate) }}</span>
      <span>วันที่จบการฝึกงาน: {{ formatThaiDate(internship.endDate) }}</span>
    </div>
  </section>
</template>
