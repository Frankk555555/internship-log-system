<script setup lang="ts">
const props = defineProps<{
  id: string
  label: string
  type: 'date' | 'time'
  error?: string
  readonly?: boolean
  /** ไม่แสดงเครื่องหมาย * หลังชื่อช่อง */
  unmarked?: boolean
}>()

// ค่าที่แสดงในช่อง: วันที่ "วว-ดด-ปปปป" (พ.ศ.) หรือเวลา "HH:MM น."
const model = defineModel<string>({ required: true })

const picker = useTemplateRef<HTMLInputElement>('picker')

function normalize(text: string) {
  if (props.type === 'date') {
    const iso = parseThaiDate(text)
    return iso ? formatThaiDate(iso) : text
  }
  const clock = parseClock(text)
  return clock ? `${clock} น.` : text
}

function onType(event: Event) {
  model.value = normalize((event.target as HTMLInputElement).value)
}

function openPicker() {
  if (!picker.value) return
  picker.value.value = (props.type === 'date' ? parseThaiDate(model.value) : parseClock(model.value)) ?? ''
  picker.value.showPicker()
}

function onPick(event: Event) {
  const { value } = event.target as HTMLInputElement
  if (!value) return
  model.value = props.type === 'date' ? formatThaiDate(value) : `${value.slice(0, 5)} น.`
}
</script>

<template>
  <div class="flex flex-col">
    <label :for="id" class="text-xs font-semibold text-slate-600">{{ label }}{{ unmarked ? '' : ' *' }}</label>
    <div
      class="relative mt-1.5 flex items-center rounded-lg border focus-within:ring-2"
      :class="[
        error ? 'border-red-400 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-indigo-100',
        readonly ? 'bg-slate-50' : 'bg-white',
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
        class="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-slate-700 outline-none"
        @change="onType"
      >
      <button
        type="button"
        :disabled="readonly"
        class="flex px-3 py-2 text-slate-700 hover:text-indigo-600 disabled:cursor-not-allowed disabled:text-slate-300"
        :aria-label="`เลือก${label}`"
        @click="openPicker"
      >
        <UIcon :name="type === 'date' ? 'i-lucide-calendar' : 'i-lucide-clock'" class="size-4" />
      </button>
      <input ref="picker" :type="type" tabindex="-1" aria-hidden="true" class="pointer-events-none absolute bottom-0 right-0 size-px opacity-0" @change="onPick">
    </div>
    <p v-if="error" :id="`${id}-error`" class="mt-1 text-[11px] font-medium text-red-500">{{ error }}</p>
  </div>
</template>
