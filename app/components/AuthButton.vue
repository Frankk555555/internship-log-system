<script setup lang="ts">
defineProps<{
  label: string
  pending?: boolean
}>()
</script>

<template>
  <button
    type="submit"
    :disabled="pending"
    class="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 text-[13px] font-semibold text-white shadow-md shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-400"
  >
    {{ pending ? 'กำลังดำเนินการ...' : label }}
    <UIcon :name="pending ? 'i-lucide-loader-circle' : 'i-lucide-log-in'" class="size-4" :class="pending ? 'animate-spin' : ''" />
  </button>
</template>
