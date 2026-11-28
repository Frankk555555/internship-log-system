<script setup lang="ts">
const props = defineProps<{
  id: string
  label: string
  type: 'date' | 'time'
  error?: string
  readonly?: boolean
}>()

// ค่าที่แสดงในช่อง: วันที่ "วว-ดด-ปปปป" (พ.ศ.) หรือเวลา "HH:MM น."
const model = defineModel<string>({ required: true })

// ใช้ตัวเลือกของระบบทั้งคู่: ปฏิทินปี พ.ศ. และเวลาแบบ 24 ชั่วโมง
const timeOpen = ref(false)
const buttonClass = 'flex px-3 py-2 text-slate-700 hover:text-brand disabled:cursor-not-allowed disabled:text-slate-300'

function normalize(text: string) {
  if (props.type === 'date') {
    const iso = parseThaiDate(text)
    return iso ? formatThaiInputDate(iso) : text
  }
  const clock = parseClock(text)
  return clock ? `${clock} น.` : text
}

function onType(event: Event) {
  model.value = normalize((event.target as HTMLInputElement).value)
}

</script>

<template>
  <div class="flex flex-col">
    <label :for="id" class="text-xs font-semibold text-slate-600">{{ label }} *</label>
    <div
      class="relative mt-1.5 flex items-center rounded-lg border focus-within:ring-2"
      :class="[
        error ? 'border-danger focus-within:ring-brand' : 'border-control focus-within:border-brand focus-within:ring-brand',
        readonly ? 'bg-page' : 'bg-white',
      ]"
    >
      <input
        :id="id"
        :value="model"
        type="text"
        required
        :readonly="readonly"
        :placeholder="type === 'date' ? 'วว-ดด-ปปปป' : '00:00'"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-slate-700 outline-hidden"
        @change="onType"
      >
      <DatePicker
        v-if="type === 'date'"
        :value="parseThaiDate(model)"
        :label="`เลือก${label}`"
        @pick="date => model = formatThaiInputDate(date)"
      >
        <button type="button" :disabled="readonly" :class="buttonClass" :aria-label="`เลือก${label}`">
          <UIcon name="i-lucide-calendar" class="size-4" />
        </button>
      </DatePicker>
      <UPopover
        v-else
        v-model:open="timeOpen"
        :content="{ align: 'end', sideOffset: 8, collisionPadding: 12 }"
        :ui="{ content: 'rounded-xl bg-white ring-line' }"
      >
        <button type="button" :disabled="readonly" :class="buttonClass" :aria-label="`เลือก${label}`">
          <UIcon name="i-lucide-clock" class="size-4" />
        </button>
        <template #content>
          <TimePickerPanel :value="parseClock(model)" :label="label" @pick="value => model = `${value} น.`" @done="timeOpen = false" />
        </template>
      </UPopover>
    </div>
    <p v-if="error" :id="`${id}-error`" class="mt-1 field-error">{{ error }}</p>
  </div>
</template>
