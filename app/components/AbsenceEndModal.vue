<script setup lang="ts">
import type { MentorAbsence } from '~/types/admin'

const props = defineProps<{
  absence?: MentorAbsence
  /** กำลังบันทึก */
  pending?: boolean
  /** ข้อความผิดพลาดจากเซิร์ฟเวอร์ */
  serverError?: string
}>()

const emit = defineEmits<{
  save: [endAt: string]
}>()

const open = defineModel<boolean>('open', { required: true })

const date = ref('')
const time = ref('')
const checked = ref(false)

// เริ่มจากเวลาสิ้นสุดเดิมทุกครั้งที่เปิด
watch(open, (isOpen) => {
  if (!isOpen || !props.absence) return
  const end = toThaiTimeParts(props.absence.endAt)
  date.value = formatThaiInputDate(end.date)
  time.value = `${end.time} น.`
  checked.value = false
}, { immediate: true })

const endAt = computed(() => {
  const day = parseThaiDate(date.value)
  const clock = parseClock(time.value)
  return day && clock ? `${day}T${clock}:00+07:00` : undefined
})

const dateError = computed(() => {
  if (!checked.value || parseThaiDate(date.value)) return undefined
  return date.value.trim() ? 'รูปแบบวันที่ไม่ถูกต้อง (วว-ดด-ปปปป พ.ศ.)' : 'กรุณากรอกวันที่สิ้นสุด'
})
const timeError = computed(() => {
  if (!checked.value) return undefined
  if (!parseClock(time.value)) return time.value.trim() ? 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)' : 'กรุณากรอกเวลาสิ้นสุด'
  return endAt.value && props.absence && Date.parse(endAt.value) <= Date.parse(props.absence.startAt) ? 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' : undefined
})

const startLabel = computed(() => {
  if (!props.absence) return ''
  const start = toThaiTimeParts(props.absence.startAt)
  return `${formatThaiDate(start.date)} • ${start.time} น.`
})

const notify = useNotify()
const form = useTemplateRef<HTMLFormElement>('form')

async function submit() {
  if (props.pending) return
  checked.value = true
  if (dateError.value || timeError.value) {
    notify('error', 'ยังบันทึกไม่ได้', 'กรุณาตรวจสอบข้อมูลในช่องที่มีข้อความเตือน')
    await focusFirstInvalid(form.value)
    return
  }
  emit('save', endAt.value!)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="ปรับเวลาสิ้นสุด"
    :dismissible="!pending"
    :close="!pending"
    :ui="{
      overlay: 'bg-slate-900/10',
      content: 'max-w-lg rounded-xl bg-white ring-slate-900 divide-slate-200',
      header: 'min-h-0 px-6 py-4',
      title: 'text-lg font-bold text-ink',
      body: 'px-6 sm:px-6 py-5 sm:py-5',
      footer: 'justify-end gap-3 px-6 sm:px-6 py-4',
    }"
  >
    <template #description>
      <span class="text-xs text-slate-600">{{ absence?.mentorName }} ไม่อยู่ตั้งแต่ {{ startLabel }}</span>
    </template>

    <template #body>
      <form id="absence-end-form" ref="form" class="space-y-4" novalidate @submit.prevent="submit">
        <div class="grid gap-3 sm:grid-cols-2">
          <DateTimeField id="adjust-end-date" v-model="date" type="date" label="วันที่สิ้นสุด" :error="dateError" />
          <DateTimeField id="adjust-end-time" v-model="time" type="time" label="เวลาสิ้นสุด" :error="timeError" />
        </div>
        <p class="rounded-lg bg-page px-3 py-2 text-xs text-slate-600">ถ้าเวลาสิ้นสุดใหม่ผ่านมาแล้ว ช่วงนี้จะจบทันที และอนุมัติแทนต่อไม่ได้</p>
        <p v-if="serverError" class="notice-error" role="alert">{{ serverError }}</p>
      </form>
    </template>

    <template #footer>
      <button type="button" :disabled="pending" class="btn btn-secondary px-6 py-2.5 text-xs" @click="open = false">
        ยกเลิก
      </button>
      <button type="submit" form="absence-end-form" :disabled="pending" class="btn btn-primary px-7 py-2.5 text-xs">
        {{ pending ? 'กำลังบันทึก...' : 'บันทึก' }}
      </button>
    </template>
  </UModal>
</template>
