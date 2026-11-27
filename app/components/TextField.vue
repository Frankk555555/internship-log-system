<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  id: string
  label: string
  error?: string
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex flex-col">
    <label :for="id" class="text-[13px] font-semibold text-slate-600">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${id}-error` : undefined"
      v-bind="$attrs"
      class="mt-1.5 h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-50 aria-invalid:border-red-400"
    >
    <p v-if="error" :id="`${id}-error`" class="mt-1 text-[11px] font-medium text-red-600">{{ error }}</p>
  </div>
</template>
