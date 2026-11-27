<script setup lang="ts">
/** แบ่งหน้าใต้ตาราง บอกช่วงที่แสดงและจำนวนทั้งหมด */
const props = withDefaults(defineProps<{
  total: number
  pageSize: number
  /** ลักษณนาม เช่น "คน" "รายการ" */
  unit?: string
  /** ปิดปุ่มระหว่างโหลดหน้าใหม่ */
  disabled?: boolean
}>(), {
  unit: 'รายการ',
})

/** เริ่มที่ 1 */
const page = defineModel<number>('page', { required: true })

const lastPage = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => (page.value - 1) * props.pageSize + 1)
const to = computed(() => Math.min(page.value * props.pageSize, props.total))

// จำนวนลดลง เช่น หลังระงับหรือกรอง อย่าค้างอยู่หน้าที่ไม่มีข้อมูล
// total 0 อาจเป็นช่วงกำลังโหลด จึงไม่ย้ายหน้า
watch(() => [props.total, page.value] as const, ([total]) => {
  if (total && page.value > lastPage.value) page.value = lastPage.value
}, { immediate: true })
</script>

<template>
  <nav class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3" aria-label="เลือกหน้าของตาราง">
    <p class="text-xs text-slate-600" aria-live="polite">
      {{ total ? `แสดง ${from}–${to} จาก ${total} ${unit}` : 'ไม่มีข้อมูลให้แสดง' }}
    </p>
    <div class="flex gap-2">
      <button type="button" class="btn btn-secondary min-h-9 px-4 text-xs" :disabled="disabled || page <= 1" @click="page -= 1">ก่อนหน้า</button>
      <button type="button" class="btn btn-secondary min-h-9 px-4 text-xs" :disabled="disabled || page >= lastPage" @click="page += 1">ถัดไป</button>
    </div>
  </nav>
</template>
