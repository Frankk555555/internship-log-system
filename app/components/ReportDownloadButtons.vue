<script setup lang="ts">
defineProps<{
  /** ปิดปุ่มระหว่างยังไม่มีข้อมูลรายงาน */
  disabled?: boolean
}>()

defineEmits<{
  excel: []
}>()

// บันทึกเป็น PDF ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์
function downloadPdf() {
  window.print()
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button type="button" :disabled="disabled" class="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-red-600 disabled:opacity-50" @click="downloadPdf">
      ดาวน์โหลด PDF
      <UIcon name="i-lucide-file-text" class="size-4" />
    </button>
    <button type="button" :disabled="disabled" class="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50" @click="$emit('excel')">
      ดาวน์โหลด Excel
      <UIcon name="i-lucide-file-spreadsheet" class="size-4" />
    </button>
  </div>
</template>
