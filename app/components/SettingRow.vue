<script setup lang="ts">
/** แถวตั้งค่าตัวเลข: ชื่อและคำอธิบายอยู่ซ้าย ค่าและหน่วยอยู่ขวา จอแคบค่าลงมาอยู่ใต้คำอธิบาย */
defineProps<{
  id: string
  label: string
  hint: string
  unit: string
  error?: string
  /** แสดงค่าอย่างเดียว */
  readonly?: boolean
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line py-4">
    <div class="min-w-0 flex-1 basis-60">
      <component :is="readonly ? 'p' : 'label'" :id="`${id}-label`" :for="readonly ? undefined : id" class="block text-sm font-semibold text-ink">{{ label }}</component>
      <p :id="`${id}-hint`" class="mt-0.5 text-xs text-slate-600">{{ hint }}</p>
      <p v-if="error" :id="`${id}-error`" class="mt-1 field-error">{{ error }}</p>
    </div>

    <div class="flex items-center gap-2">
      <!-- ค่าที่แก้ไม่ได้ไม่ใช้ช่องกรอก จะได้ไม่ดูเหมือนกดแก้ได้ -->
      <span v-if="readonly" class="flex h-10 w-20 items-center justify-end rounded-lg border border-line bg-page px-3 text-sm font-semibold tabular-nums text-slate-600">{{ model }}</span>
      <input
        v-else
        :id="id"
        v-model="model"
        type="text"
        inputmode="numeric"
        maxlength="3"
        autocomplete="off"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? `${id}-hint ${id}-error` : `${id}-hint`"
        class="field h-10 w-20 bg-white px-3 text-right text-sm font-semibold tabular-nums text-ink"
      >
      <span class="w-9 text-sm text-slate-600">{{ unit }}</span>
    </div>
  </div>
</template>
