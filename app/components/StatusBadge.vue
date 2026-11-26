<script setup lang="ts">
import type { BadgeTone } from '~/types/worklog'

defineProps<{
  label: string
  tone: BadgeTone
  solid?: boolean
}>()

const toneClasses: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-500',
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-emerald-100 text-emerald-600',
  pink: 'bg-pink-100 text-pink-600',
  amber: 'bg-amber-100 text-amber-600',
}

const solidClasses: Record<BadgeTone, string> = {
  slate: 'bg-slate-500 text-white',
  blue: 'bg-blue-600 text-white',
  green: 'bg-emerald-500 text-white',
  pink: 'bg-pink-500 text-white',
  amber: 'bg-amber-500 text-white',
}
</script>

<template>
  <span class="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold" :class="solid ? solidClasses[tone] : toneClasses[tone]">
    {{ label }}
  </span>
</template>
