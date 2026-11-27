<script setup lang="ts">
import { errorMessage } from '~/services/api'

definePageMeta({ layout: 'mentor', role: 'supervisor' })
useHead({ title: 'ตารางเวลาไม่สะดวก' })

const api = useApi()
const notify = useNotify()

// วันที่ปัจจุบันของเซิร์ฟเวอร์ ใช้เป็นค่าตั้งต้นและกันการเลือกวันย้อนหลัง
const { data: today, status, error, refresh } = await useLazyAsyncData('server-today', async () => toThaiTimeParts(await api.getServerTime()).date)

const date = ref('')
const startTime = ref('')
const endTime = ref('')
const reason = ref('')
const checked = ref(false)
const pending = ref(false)
const failure = ref<string>()

watch(today, (value) => {
  if (value && !date.value) date.value = formatThaiInputDate(value)
}, { immediate: true })

const day = computed(() => parseThaiDate(date.value))
const start = computed(() => parseClock(startTime.value))
const end = computed(() => parseClock(endTime.value))

const errors = computed(() => {
  if (!checked.value) return {}

  return {
    date: !date.value.trim()
      ? 'กรุณากรอกวันที่'
      : !day.value
          ? 'รูปแบบวันที่ไม่ถูกต้อง (วว-ดด-ปปปป พ.ศ.)'
          : today.value && day.value < today.value ? 'ไม่สามารถแจ้งวันที่ผ่านมาแล้ว' : undefined,
    start: !startTime.value.trim() ? 'กรุณากรอกเวลาเริ่ม' : !start.value ? 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)' : undefined,
    end: !endTime.value.trim()
      ? 'กรุณากรอกเวลาสิ้นสุด'
      : !end.value
          ? 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)'
          : start.value && toMinutes(end.value) <= toMinutes(start.value) ? 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม' : undefined,
    reason: !reason.value.trim() ? 'กรุณาระบุเหตุผล' : undefined,
  }
})

watch([date, startTime, endTime, reason], () => {
  failure.value = undefined
})

const form = useTemplateRef<HTMLFormElement>('form')

async function save() {
  if (pending.value) return
  checked.value = true
  failure.value = undefined
  if (Object.values(errors.value).some(Boolean)) {
    notify('error', 'ยังบันทึกไม่ได้', 'กรุณาตรวจสอบข้อมูลให้ครบและถูกต้อง')
    await focusFirstInvalid(form.value)
    return
  }

  pending.value = true
  try {
    await api.createUnavailability({ date: day.value!, startTime: start.value!, endTime: end.value!, reason: reason.value.trim() })
    notify('success', 'บันทึกเวลาไม่สะดวกแล้ว', `${formatThaiDate(day.value!)} เวลา ${start.value}–${end.value} น.\nนักศึกษาในความดูแลจะเห็นช่วงเวลานี้`)
    startTime.value = ''
    endTime.value = ''
    reason.value = ''
    checked.value = false
  }
  catch (problem) {
    failure.value = errorMessage(problem)
    notify('error', 'บันทึกไม่สำเร็จ', failure.value)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      class="mb-4"
      title="ตารางเวลาไม่สะดวก"
      description="แจ้งนักศึกษาให้ทราบช่วงเวลาที่ไม่สะดวกตรวจงาน"
      :crumbs="[{ label: 'พื้นที่พี่เลี้ยง' }, { label: 'ตารางเวลาไม่สะดวก' }]"
    />

    <div class="lg:w-[61%]">
      <AsyncState :loading="!today && status !== 'error'" :error="error" @retry="refresh()">
        <form ref="form" class="card flex flex-col gap-3 p-5" novalidate @submit.prevent="save">
          <h2 class="mb-1 text-base font-bold text-ink">เวลาไม่สะดวก</h2>

          <DateTimeField id="unavailable-date" v-model="date" type="date" label="วันที่" :error="errors.date" :readonly="pending" />
          <DateTimeField id="unavailable-start" v-model="startTime" type="time" label="เริ่ม" :error="errors.start" :readonly="pending" />
          <DateTimeField id="unavailable-end" v-model="endTime" type="time" label="สิ้นสุด" :error="errors.end" :readonly="pending" />
          <TextField id="unavailable-reason" v-model="reason" label="เหตุผล *" type="text" required :readonly="pending" :error="errors.reason" />

          <p v-if="failure" class="notice-error" role="alert">{{ failure }}</p>

          <div class="mt-4 flex justify-end gap-5">
            <BackButton fallback="/mentor/reviews" label="กลับ" />
            <button type="submit" :disabled="pending" class="btn btn-primary px-3.5 py-2.5 text-xs">
              {{ pending ? 'กำลังบันทึก...' : 'บันทึก' }}
            </button>
          </div>
        </form>
      </AsyncState>
    </div>
  </div>
</template>
