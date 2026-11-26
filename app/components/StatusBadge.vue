<script setup lang="ts">
type BadgeTone = 'slate' | 'blue' | 'green' | 'pink'

defineProps<{
  label: string
  tone: BadgeTone
}>()

const toneClasses: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-500',
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-emerald-100 text-emerald-600',
  pink: 'bg-pink-100 text-pink-600',
}
</script>

<template>
  <span class="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold" :class="toneClasses[tone]">
    {{ label }}
  </span>
</template>
