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
    <label :for="id" class="text-[0.8125rem] font-semibold text-slate-600">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${id}-error` : undefined"
      v-bind="$attrs"
      class="field mt-1.5 h-10 bg-white px-3 text-[0.8125rem]"
    >
    <p v-if="error" :id="`${id}-error`" class="mt-1 field-error">{{ error }}</p>
  </div>
</template>
