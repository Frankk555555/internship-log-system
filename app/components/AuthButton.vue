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
    class="btn btn-primary h-12 w-full gap-2.5 rounded-xl text-[0.8125rem]"
  >
    {{ pending ? 'กำลังดำเนินการ...' : label }}
    <UIcon :name="pending ? 'i-lucide-loader-circle' : 'i-lucide-log-in'" class="size-4" :class="pending ? 'animate-spin' : ''" />
  </button>
</template>
