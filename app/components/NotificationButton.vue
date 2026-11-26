<script setup lang="ts">
defineProps<{
  count?: number
}>()
</script>

<template>
  <button type="button" class="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm" aria-label="การแจ้งเตือน">
    <UIcon name="i-lucide-bell" class="size-4" />
    <span v-if="count" class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{{ count }}</span>
  </button>
</template>
