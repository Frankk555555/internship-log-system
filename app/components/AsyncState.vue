<script setup lang="ts">
// สถานะกำลังโหลด / ผิดพลาด ของข้อมูลจาก API
defineProps<{
  loading: boolean
  error?: { message: string } | null
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center" role="alert">
    <p class="text-sm font-medium text-red-700">{{ error.message }}</p>
    <button type="button" class="btn btn-secondary mt-3 px-4 py-2 text-xs" @click="$emit('retry')">
      ลองอีกครั้ง
    </button>
  </div>
  <div v-else-if="loading" class="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-12 text-sm text-slate-500" role="status">
    <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
    กำลังโหลดข้อมูล...
  </div>
  <slot v-else />
</template>
