<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  value: string | number
  secondaryValue?: string | number
  meta: string
  tone?: 'green' | 'orange'
}>(), {
  secondaryValue: undefined,
  tone: 'green',
})
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
    <p class="text-[11px] font-medium text-slate-500">{{ title }}</p>
    <div class="mt-1 flex items-end justify-between gap-3">
      <div class="flex items-baseline gap-1.5">
        <span class="text-3xl font-semibold leading-none" :class="tone === 'green' ? 'text-emerald-500' : 'text-orange-500'">{{ value }}</span>
        <template v-if="secondaryValue !== undefined">
          <span class="text-xl font-medium text-slate-300">/</span>
          <span class="text-2xl font-semibold leading-none text-red-500">{{ secondaryValue }}</span>
        </template>
      </div>
      <span class="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{{ meta }}</span>
    </div>
  </section>
</template>
