<script setup lang="ts" generic="Value extends string">
/** แถบตัวกรองที่เลือกได้ครั้งละหนึ่งค่า พร้อมจำนวนของแต่ละค่า */
defineProps<{
  /** ชื่อกลุ่มสำหรับโปรแกรมอ่านหน้าจอ เช่น "กรองตามบทบาท" */
  label: string
  options: { value: Value, label: string, count?: number }[]
}>()

const model = defineModel<Value>({ required: true })
</script>

<template>
  <div class="flex flex-wrap gap-2" role="group" :aria-label="label">
    <!-- ตัวที่เลือกใช้ขอบ primary ให้ต่างจากรอบข้างเกิน 3:1 (docs/design-pattern.md ข้อ 6) -->
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="model === option.value"
      class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold"
      :class="model === option.value ? 'border-brand text-brand ring-1 ring-brand' : 'border-line text-slate-600 hover:bg-page'"
      @click="model = option.value"
    >
      {{ option.label }}
      <span v-if="option.count !== undefined" class="font-normal tabular-nums" :class="model === option.value ? 'text-brand' : 'text-ink-muted'">{{ option.count }}</span>
    </button>
  </div>
</template>
