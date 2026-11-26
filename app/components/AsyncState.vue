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
    <p class="text-sm font-medium text-red-600">{{ error.message }}</p>
    <button type="button" class="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100" @click="$emit('retry')">
      ลองอีกครั้ง
    </button>
  </div>
  <div v-else-if="loading" class="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-12 text-sm text-slate-400" role="status">
    <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
    กำลังโหลดข้อมูล...
  </div>
  <slot v-else />
</template>
