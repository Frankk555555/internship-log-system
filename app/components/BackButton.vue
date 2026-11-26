<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** หน้าที่ไปเมื่อไม่มีหน้าก่อนหน้าให้ย้อน เช่น เปิดจากลิงก์โดยตรง */
  fallback: string
  label?: string
}>(), { label: 'ย้อนกลับ' })

const goBack = useGoBack()
</script>

<template>
  <button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 print:hidden" @click="goBack(props.fallback)">
    <UIcon name="i-lucide-arrow-left" class="size-3.5" />
    {{ label }}
  </button>
</template>
