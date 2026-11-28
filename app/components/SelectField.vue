<script setup lang="ts">
/** ช่องเลือก หน้าตาและข้อความผิดพลาดแบบเดียวกับ TextField */
defineOptions({ inheritAttrs: false })

defineProps<{
  id: string
  label: string
  options: { value: string, label: string }[]
  /** ข้อความตอนยังไม่เลือก ค่าของช่องเป็นสตริงว่าง */
  placeholder?: string
  error?: string
  /** ซ่อนชื่อช่องจากหน้าจอ ใช้ในแถบเครื่องมือ โปรแกรมอ่านหน้าจอยังอ่านได้ */
  hideLabel?: boolean
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex flex-col">
    <label :for="id" :class="hideLabel ? 'sr-only' : 'mb-1.5 text-[0.8125rem] font-semibold text-slate-600'">{{ label }}</label>
    <div class="relative">
      <select
        :id="id"
        v-model="model"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? `${id}-error` : undefined"
        v-bind="$attrs"
        class="field h-10 w-full appearance-none bg-white pl-3 pr-9 text-[0.8125rem]"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <UIcon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
    </div>
    <p v-if="error" :id="`${id}-error`" class="mt-1 field-error">{{ error }}</p>
  </div>
</template>
