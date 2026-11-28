<script setup lang="ts">
import type { InternshipDetail, InternshipInput } from '~/types/admin'

const props = defineProps<{
  detail: InternshipDetail
  /** กำลังบันทึก */
  pending?: boolean
  /** ข้อความผิดพลาดจากเซิร์ฟเวอร์ */
  serverError?: string
}>()

const emit = defineEmits<{
  save: [input: InternshipInput]
  cancel: []
}>()

/** มีการแก้ที่ยังไม่บันทึก */
const dirty = defineModel<boolean>('dirty', { default: false })

function fieldsOf(detail: InternshipDetail) {
  return {
    company: detail.company ?? '',
    position: detail.position ?? '',
    startDate: detail.startDate ? formatThaiInputDate(detail.startDate) : '',
    endDate: detail.endDate ? formatThaiInputDate(detail.endDate) : '',
    workStart: detail.workStartTime ? `${detail.workStartTime} น.` : '',
    workEnd: detail.workEndTime ? `${detail.workEndTime} น.` : '',
    mentor: detail.mentorId ? String(detail.mentorId) : '',
  }
}

const input = reactive(fieldsOf(props.detail))
const checked = ref(false)

// เลือกนักศึกษาคนอื่นหรือบันทึกแล้ว เริ่มจากค่าล่าสุด
watch(() => props.detail, (detail) => {
  Object.assign(input, fieldsOf(detail))
  checked.value = false
})

watch(() => JSON.stringify(input) !== JSON.stringify(fieldsOf(props.detail)), (value) => {
  dirty.value = value
}, { immediate: true })

/** ค่าในรูปแบบที่ส่งให้เซิร์ฟเวอร์ ช่องที่ว่างหรือรูปแบบผิดเป็นสตริงว่าง */
const parsed = computed(() => ({
  company: input.company.trim(),
  position: input.position.trim(),
  startDate: parseThaiDate(input.startDate) ?? '',
  endDate: parseThaiDate(input.endDate) ?? '',
  workStartTime: parseClock(input.workStart) ?? '',
  workEndTime: parseClock(input.workEnd) ?? '',
  mentorId: input.mentor ? Number(input.mentor) : undefined,
}))

const errors = computed(() => {
  if (!checked.value) return {} as Partial<ReturnType<typeof internshipErrors>>
  const found = internshipErrors(parsed.value)
  // กรอกแล้วแต่รูปแบบผิด บอกรูปแบบที่ถูกแทนการบอกว่ายังไม่กรอก
  const format = (text: string, value: string, message: string) => text.trim() && !value ? message : undefined
  const dateFormat = 'รูปแบบวันที่ไม่ถูกต้อง (วว-ดด-ปปปป พ.ศ.)'
  const timeFormat = 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)'
  return {
    ...found,
    startDate: format(input.startDate, parsed.value.startDate, dateFormat) ?? found.startDate,
    endDate: format(input.endDate, parsed.value.endDate, dateFormat) ?? found.endDate,
    workStartTime: format(input.workStart, parsed.value.workStartTime, timeFormat) ?? found.workStartTime,
    workEndTime: format(input.workEnd, parsed.value.workEndTime, timeFormat) ?? found.workEndTime,
  }
})

const hoursChanged = computed(() => Boolean(props.detail.workStartTime && parsed.value.workStartTime && parsed.value.workEndTime)
  && (parsed.value.workStartTime !== props.detail.workStartTime || parsed.value.workEndTime !== props.detail.workEndTime))
const mentorChanged = computed(() => Boolean(props.detail.mentorId) && parsed.value.mentorId !== props.detail.mentorId)

const mentorOptions = computed(() => props.detail.mentors.map(({ id, name }) => ({ value: String(id), label: name })))

const notify = useNotify()
const form = useTemplateRef<HTMLFormElement>('form')

async function submit() {
  if (props.pending) return
  checked.value = true
  if (Object.values(errors.value).some(Boolean)) {
    notify('error', 'ยังบันทึกไม่ได้', 'กรุณาตรวจสอบข้อมูลในช่องที่มีข้อความเตือน')
    await focusFirstInvalid(form.value)
    return
  }
  if (!dirty.value) {
    notify('info', 'ไม่มีการเปลี่ยนแปลง', 'ข้อมูลฝึกงานยังเหมือนเดิม')
    return
  }
  emit('save', { ...parsed.value, mentorId: parsed.value.mentorId! })
}
</script>

<template>
  <form ref="form" class="space-y-4" novalidate @submit.prevent="submit">
    <TextField id="internship-company" v-model="input.company" label="หน่วยงาน" autocomplete="off" required :error="errors.company" />
    <TextField id="internship-position" v-model="input.position" label="ตำแหน่ง" autocomplete="off" required :error="errors.position" />
    <div class="grid gap-3 sm:grid-cols-2">
      <DateTimeField id="internship-start" v-model="input.startDate" type="date" label="วันเริ่มฝึกงาน" :error="errors.startDate" />
      <DateTimeField id="internship-end" v-model="input.endDate" type="date" label="วันสิ้นสุด" :error="errors.endDate" />
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <DateTimeField id="internship-work-start" v-model="input.workStart" type="time" label="เวลาเข้างาน" :error="errors.workStartTime" />
      <DateTimeField id="internship-work-end" v-model="input.workEnd" type="time" label="เวลาเลิกงาน" :error="errors.workEndTime" />
    </div>

    <p v-if="hoursChanged" class="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
      <UIcon name="i-lucide-triangle-alert" class="mt-px size-4 shrink-0" />
      เวลางานใหม่มีผลกับรายการตั้งแต่วันนี้ รายการของวันก่อนหน้ายังตรวจตามเวลาเดิม
    </p>

    <div>
      <SelectField id="internship-mentor" v-model="input.mentor" label="พี่เลี้ยง *" placeholder="เลือกพี่เลี้ยง" :options="mentorOptions" :error="errors.mentorId" />
      <p v-if="mentorChanged && detail.pendingCount" class="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
        <UIcon name="i-lucide-triangle-alert" class="mt-px size-4 shrink-0" />
        งานรอตรวจ {{ detail.pendingCount }} รายการจะย้ายไปให้พี่เลี้ยงคนใหม่
      </p>
    </div>

    <section class="border-t border-line pt-3" aria-label="ประวัติพี่เลี้ยง">
      <h3 class="text-[0.8125rem] font-semibold text-slate-600">ประวัติพี่เลี้ยง</h3>
      <ul v-if="detail.mentorHistory.length" class="mt-1.5 space-y-1.5 text-xs">
        <li v-for="(period, index) in detail.mentorHistory" :key="index">
          <span class="font-semibold text-ink">{{ period.mentorName }}</span>
          <span class="block text-slate-600">{{ period.to ? `${formatThaiDate(period.from)} ถึง ${formatThaiDate(period.to)}` : `ตั้งแต่ ${formatThaiDate(period.from)} (ปัจจุบัน)` }}</span>
        </li>
      </ul>
      <p v-else class="mt-1.5 text-xs text-slate-600">ยังไม่เคยกำหนด เมื่อเปลี่ยนพี่เลี้ยง ระบบเก็บชื่อเดิมและวันที่เปลี่ยนไว้ในประวัติ</p>
    </section>

    <p v-if="serverError" class="notice-error" role="alert">{{ serverError }}</p>

    <div class="flex gap-3">
      <button type="submit" :disabled="pending" class="btn btn-primary px-7 py-2.5 text-xs">
        {{ pending ? 'กำลังบันทึก...' : 'บันทึก' }}
      </button>
      <button type="button" :disabled="pending" class="btn btn-secondary px-6 py-2.5 text-xs" @click="emit('cancel')">
        ยกเลิก
      </button>
    </div>
  </form>
</template>
