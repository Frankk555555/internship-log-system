<script setup lang="ts">
import type { AbsenceInput } from '~/types/admin'

const props = defineProps<{
  mentors: { id: number, name: string }[]
  /** กำลังบันทึก */
  pending?: boolean
  /** ข้อความผิดพลาดจากเซิร์ฟเวอร์ */
  serverError?: string
}>()

const emit = defineEmits<{
  save: [input: AbsenceInput]
  /** ผู้ใช้แก้ข้อมูล ข้อความจากเซิร์ฟเวอร์ครั้งก่อนไม่ใช้แล้ว */
  edit: []
}>()

const blank = () => ({ mentor: '', startDate: '', startTime: '', endDate: '', endTime: '', reason: '' })
const input = reactive(blank())
const checked = ref(false)

watch(input, () => emit('edit'))

const parsed = computed(() => ({
  mentorId: input.mentor ? Number(input.mentor) : undefined,
  startDate: parseThaiDate(input.startDate) ?? '',
  startTime: parseClock(input.startTime) ?? '',
  endDate: parseThaiDate(input.endDate) ?? '',
  endTime: parseClock(input.endTime) ?? '',
  reason: input.reason.trim(),
}))

const errors = computed(() => {
  if (!checked.value) return {} as Partial<ReturnType<typeof absenceErrors>>
  const found = absenceErrors(parsed.value)
  // กรอกแล้วแต่รูปแบบผิด บอกรูปแบบที่ถูกแทนการบอกว่ายังไม่กรอก
  const format = (text: string, value: string, message: string) => text.trim() && !value ? message : undefined
  const dateFormat = 'รูปแบบวันที่ไม่ถูกต้อง (วว-ดด-ปปปป พ.ศ.)'
  const timeFormat = 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)'
  return {
    ...found,
    startDate: format(input.startDate, parsed.value.startDate, dateFormat) ?? found.startDate,
    startTime: format(input.startTime, parsed.value.startTime, timeFormat) ?? found.startTime,
    endDate: format(input.endDate, parsed.value.endDate, dateFormat) ?? found.endDate,
    endTime: format(input.endTime, parsed.value.endTime, timeFormat) ?? found.endTime,
  }
})

const mentorOptions = computed(() => props.mentors.map(({ id, name }) => ({ value: String(id), label: name })))

function reset() {
  Object.assign(input, blank())
  checked.value = false
}

const notify = useNotify()

function clear() {
  const hadInput = Object.values(input).some(Boolean)
  reset()
  if (hadInput) notify('info', 'ล้างข้อมูลแล้ว', 'ยังไม่ได้บันทึกอะไร')
}

const form = useTemplateRef<HTMLFormElement>('form')

async function submit() {
  if (props.pending) return
  checked.value = true
  if (Object.values(errors.value).some(Boolean)) {
    notify('error', 'ยังบันทึกไม่ได้', 'กรุณาตรวจสอบข้อมูลในช่องที่มีข้อความเตือน')
    await focusFirstInvalid(form.value)
    return
  }
  const { mentorId, startDate, startTime, endDate, endTime, reason } = parsed.value
  emit('save', { mentorId: mentorId!, startAt: `${startDate}T${startTime}:00+07:00`, endAt: `${endDate}T${endTime}:00+07:00`, reason })
}

// หน้าที่เรียกใช้ล้างฟอร์มเมื่อบันทึกสำเร็จ
defineExpose({ reset })
</script>

<template>
  <form ref="form" class="space-y-4" novalidate @submit.prevent="submit">
    <SelectField id="absence-mentor" v-model="input.mentor" label="พี่เลี้ยง *" placeholder="เลือกพี่เลี้ยง" :options="mentorOptions" :error="errors.mentorId" />
    <div class="grid gap-3 sm:grid-cols-2">
      <DateTimeField id="absence-start-date" v-model="input.startDate" type="date" label="วันที่เริ่ม" :error="errors.startDate" />
      <DateTimeField id="absence-start-time" v-model="input.startTime" type="time" label="เวลาเริ่ม" :error="errors.startTime" />
      <DateTimeField id="absence-end-date" v-model="input.endDate" type="date" label="วันที่สิ้นสุด" :error="errors.endDate" />
      <DateTimeField id="absence-end-time" v-model="input.endTime" type="time" label="เวลาสิ้นสุด" :error="errors.endTime" />
    </div>
    <div>
      <TextField id="absence-reason" v-model="input.reason" label="เหตุผล *" autocomplete="off" required :error="errors.reason" />
      <p class="mt-1 text-2xs text-ink-muted">นักศึกษาไม่เห็นเหตุผลนี้</p>
    </div>

    <div class="rounded-lg bg-page px-3 py-2.5 text-xs text-slate-600">
      <p class="font-semibold text-ink">ระหว่างช่วงนี้</p>
      <ul class="mt-1 space-y-1">
        <li>แอดมินอนุมัติงานแทนได้ ระบบบันทึกว่าอนุมัติแทนใคร</li>
        <li>ส่งกลับแก้ไขต้องรอพี่เลี้ยง</li>
        <li>พี่เลี้ยงกลับก่อนกำหนด ให้ปรับเวลาสิ้นสุด ไม่ลบรายการ</li>
      </ul>
    </div>

    <p v-if="serverError" class="notice-error" role="alert">{{ serverError }}</p>

    <div class="flex gap-3">
      <button type="submit" :disabled="pending" class="btn btn-primary px-7 py-2.5 text-xs">
        {{ pending ? 'กำลังบันทึก...' : 'บันทึก' }}
      </button>
      <button type="button" :disabled="pending" class="btn btn-secondary px-6 py-2.5 text-xs" @click="clear">
        ล้างข้อมูล
      </button>
    </div>
  </form>
</template>
