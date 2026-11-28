<script setup lang="ts">
import type { ReportView } from '~/utils/report'

const view = defineModel<ReportView>({ required: true })

const options: { value: ReportView, label: string }[] = [
  { value: 'day', label: 'รายวัน' },
  { value: 'week', label: 'รายสัปดาห์' },
  { value: 'year', label: 'รายปี' },
]
</script>

<template>
  <div class="flex w-fit rounded-lg bg-slate-100 p-1" role="group" aria-label="ชนิดรายงาน">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="view === option.value"
      class="min-h-8 min-w-20 rounded-md border px-3 py-1.5 text-xs font-semibold sm:min-w-24 sm:px-4"
      :class="view === option.value ? 'border-brand bg-white text-brand shadow-sm' : 'border-transparent text-slate-600 hover:text-slate-800'"
      @click="view = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
