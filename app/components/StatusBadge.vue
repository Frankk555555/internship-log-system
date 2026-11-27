<script setup lang="ts">
import type { BadgeTone } from '~/types/worklog'

defineProps<{
  label: string
  tone: BadgeTone
}>()

// สีตาม docs/design-pattern.md ข้อ 4 มีเฉพาะ "อนุมัติแล้ว" ที่พื้นทึบ
const toneClasses: Record<BadgeTone, string> = {
  slate: 'bg-slate-200 text-slate-600',
  draft: 'border-line bg-slate-100 text-slate-600',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  approved: 'bg-done text-white',
}
</script>

<template>
  <span class="inline-flex whitespace-nowrap rounded-full border border-transparent px-2.5 py-1 text-[10px] font-semibold" :class="toneClasses[tone]">
    {{ label }}
  </span>
</template>
