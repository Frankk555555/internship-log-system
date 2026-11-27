<script setup lang="ts">
import type { InternshipInfo } from '~/types/worklog'

defineProps<{
  internship: InternshipInfo
}>()
</script>

<template>
  <section class="card p-2.5  lg:col-span-2">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-2xs font-medium text-ink-muted">สถานที่ฝึกงาน</p>
        <h2 class="mt-1 text-base font-bold text-ink">{{ internship.company }}</h2>
      </div>
      <span class="rounded-full bg-indigo-50 px-2.5 py-1 text-2xs font-semibold text-brand">
        {{ internship.progress }}% ของระยะเวลาฝึก
      </span>
    </div>

    <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
      <div class="h-full rounded-full bg-brand" :style="{ width: `${internship.progress}%` }" />
    </div>

    <div class="mt-1 flex flex-col gap-1 text-2xs font-medium text-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <span>วันที่เริ่มการฝึกงาน: {{ formatThaiDate(internship.startDate) }}</span>
      <span>วันที่จบการฝึกงาน: {{ formatThaiDate(internship.endDate) }}</span>
    </div>
  </section>
</template>
