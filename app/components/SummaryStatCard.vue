<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  value: string | number
  secondaryValue?: string | number
  meta?: string
  tone?: 'green' | 'orange' | 'amber' | 'slate'
  compact?: boolean
}>(), {
  secondaryValue: undefined,
  meta: undefined,
  tone: 'green',
})

const valueClasses = {
  green: 'text-emerald-500',
  orange: 'text-orange-500',
  amber: 'text-amber-600',
  slate: 'text-slate-900',
}
</script>

<template>
  <section class="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
    <p class="text-[11px] font-medium text-slate-500">{{ title }}</p>
    <div class="mt-1 flex items-end justify-between gap-3">
      <div class="flex items-baseline gap-1.5">
        <span class="font-semibold leading-none" :class="[valueClasses[tone], compact ? 'text-xl' : 'text-3xl']">{{ value }}</span>
        <template v-if="secondaryValue !== undefined">
          <span class="text-xl font-medium text-slate-300">/</span>
          <span class="text-2xl font-semibold leading-none text-red-500">{{ secondaryValue }}</span>
        </template>
      </div>
      <span v-if="meta" class="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{{ meta }}</span>
    </div>
  </section>
</template>
