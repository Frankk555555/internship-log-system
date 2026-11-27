<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { Attachment, WorkLog, WorklogFormContext } from '~/types/worklog'

const props = defineProps<{
  context: WorklogFormContext
  /** มีค่า = แก้ไขรายการเดิม (ฉบับร่างหรือถูกส่งกลับ) แทนการสร้างรายการใหม่ */
  worklog?: WorkLog
}>()

const api = useApi()
const submitDone = useSubmitDone()
const { today, backdateLimitDays, workEndTime, internshipStart, internshipEnd } = props.context
const isEditing = Boolean(props.worklog)
const isResubmit = props.worklog?.reviewStatus === 'returned'
// ฉบับร่างที่ยังทำไม่เสร็จ บันทึกร่างได้โดยยังไม่มีเวลา แต่ส่งตรวจต้องมีครบ
const isDraftEdit = props.worklog?.reviewStatus === 'draft'
const initial = props.worklog ?? props.context.defaults

// ข้อมูลล่าสุดที่บันทึกไว้ ใช้กำหนดว่าช่องเวลาใดถูกล็อก
const current = shallowRef(props.worklog)
const worklogId = ref<number | undefined>(props.worklog?.id)
const date = ref(initial.date ? formatThaiInputDate(initial.date) : '')
const startTime = ref(initial.startTime ? `${initial.startTime} น.` : '')
const endTime = ref(initial.endTime ? `${initial.endTime} น.` : '')
const title = ref(initial.title)
const description = ref(initial.description ?? '')
const attachments = ref<Attachment[]>((initial.attachments ?? []).map(file => ({ ...file })))
const checked = ref<'draft' | 'submit'>()
const pending = ref<'finish' | 'draft' | 'submit'>()
const isSubmitted = ref(false)
const { error: formError, clear, fail, done } = useFormNotice()
const isLocked = computed(() => isSubmitted.value || Boolean(pending.value))

// ช่วงวันที่บันทึกย้อนหลังได้ ต้องอยู่ในช่วงฝึกงานด้วย (ขอบเขตงานข้อ 5.6)
const windowStart = addDays(today, -backdateLimitDays)
const earliestDate = computed(() => earliestEntryDate(current.value, today, backdateLimitDays))
const allowedFrom = computed(() => earliestDate.value > internshipStart ? earliestDate.value : internshipStart)
const allowedTo = today < internshipEnd ? today : internshipEnd

const clock = useServerClock()
const afterWork = computed(() => Boolean(clock.value) && isAfterWork(clock.value!.time, workEndTime))
const policy = computed(() => timePolicy(current.value, today, afterWork.value))
const timeNotice = computed(() => {
  const log = current.value
  if (!log || isSubmitted.value) return undefined
  if (log.reviewStatus === 'returned') {
    return log.timeEditAllowed
      ? 'พี่เลี้ยงเปิดให้แก้วันที่และเวลา การแก้ไขจะแสดงให้พี่เลี้ยงเห็น'
      : 'วันที่และเวลาถูกล็อก หากเวลาผิดให้แจ้งพี่เลี้ยงเปิดให้แก้ ถ้าทำงานเพิ่มให้สร้างเป็นรายการใหม่'
  }
  if (log.timeSource !== 'timer' && log.timeSource !== 'timer_manual_end') return undefined
  if (policy.value.end) {
    const reason = log.date < today ? 'ไม่ได้กด "ทำงานนี้เสร็จสิ้น" ในวันนั้น' : `เลยเวลาเลิกงาน ${workEndTime} น. แล้ว`
    return `${reason} กรอกเวลาที่ทำเสร็จจริง (ไม่เกินเวลาเลิกงาน) ได้ครั้งเดียว ตรวจสอบก่อนบันทึก รายการจะติดป้าย "กรอกเวลาเอง"`
  }
  return log.endTime
    ? 'ระบบบันทึกเวลาของรายการนี้แล้ว แก้ไขวันที่และเวลาไม่ได้'
    : 'ระบบจับเวลารายการนี้ แก้วันที่และเวลาเริ่มไม่ได้ กด "ทำงานนี้เสร็จสิ้น" เพื่อบันทึกเวลาสิ้นสุด'
})

const workDate = computed(() => parseThaiDate(date.value))
const start = computed(() => parseClock(startTime.value))
const end = computed(() => parseClock(endTime.value))

// รายการอื่นในวันที่เลือก ใช้รวมชั่วโมงและตรวจเวลาซ้อนทับ
const { data: sameDayLogs, error: sameDayError, refresh: refreshSameDay } = useLazyAsyncData(
  'backdate-same-day',
  async () => {
    const day = workDate.value
    return { date: day, worklogs: day ? await api.listWorklogs(day, day) : [] }
  },
  { watch: [workDate] },
)

function requiredError(value: string, label: string) {
  return checked.value && !value.trim() ? `กรุณากรอก${label}` : undefined
}

const dateError = computed(() => {
  // ส่งตรวจสำเร็จแล้ว ไม่ต้องตรวจช่วงวันซ้ำ
  if (isSubmitted.value) return undefined
  if (!date.value.trim()) return requiredError(date.value, 'วันที่ทำงาน')

  const value = workDate.value
  if (!value) return 'รูปแบบวันที่ไม่ถูกต้อง (วว-ดด-ปปปป พ.ศ.)'
  if (value > today) return 'ไม่สามารถบันทึกวันที่ในอนาคต'

  const reasons = [
    value < internshipStart || value > internshipEnd ? 'อยู่นอกช่วงฝึกงาน' : undefined,
    value < earliestDate.value ? 'เกินช่วงย้อนหลังที่อนุญาต' : undefined,
  ].filter(Boolean)

  return reasons.length ? reasons.join(' และ') : undefined
})

const timesOptional = computed(() => isDraftEdit && checked.value !== 'submit')

// รายการของวันนี้กรอกได้เฉพาะเวลาที่ผ่านมาแล้ว (เซิร์ฟเวอร์ตรวจซ้ำตอนบันทึก)
function futureError(time: string) {
  return clock.value && workDate.value ? futureTimeError(workDate.value, time, clock.value) : undefined
}

const startError = computed(() => {
  if (!startTime.value.trim()) {
    return timesOptional.value && !endTime.value.trim() ? undefined : requiredError(startTime.value, 'เวลาเริ่ม')
  }
  if (!start.value) return 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)'
  return startTimeError(start.value, props.context) ?? futureError(start.value)
})

const endError = computed(() => {
  if (!endTime.value.trim()) {
    if (timesOptional.value) return undefined
    if (!policy.value.end && checked.value) return 'กด "ทำงานนี้เสร็จสิ้น" เพื่อบันทึกเวลาสิ้นสุด'
    return requiredError(endTime.value, 'เวลาสิ้นสุด')
  }
  if (!end.value) return 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)'
  if (!start.value || startError.value) return undefined
  return timeRangeError(start.value, end.value, props.context) ?? futureError(end.value)
})

// รายการอื่นของวันที่เลือก (ไม่นับรายการนี้เอง) ไม่มีค่าระหว่างโหลด
const others = computed(() => {
  // รอจนข้อมูลตรงกับวันที่เลือก ไม่ใช้ข้อมูลของวันก่อนหน้า
  const loaded = sameDayLogs.value?.date === workDate.value ? sameDayLogs.value?.worklogs : undefined
  return loaded?.filter(log => log.id !== worklogId.value)
})

// เวลาซ้อนทับ ห้ามบันทึก (ขอบเขตงานข้อ 5.7)
const overlaps = computed(() => {
  if (!workDate.value || !start.value || dateError.value || startError.value || endError.value) return []
  return others.value ? findOverlaps(others.value, start.value, end.value) : []
})

// รายการอื่นของวันเดียวกันที่ถูกนับรวมในยอดทั้งวัน
const countedOthers = computed(() => (others.value ?? [])
  .flatMap(log => log.startTime && log.endTime
    ? [{ ...log, startTime: log.startTime, endTime: log.endTime, minutes: toMinutes(log.endTime) - toMinutes(log.startTime) }]
    : [])
  .sort((a, b) => a.startTime.localeCompare(b.startTime)))

const hours = computed(() => {
  if (!workDate.value || !start.value || !end.value || dateError.value || startError.value || endError.value) return undefined

  const entry = toMinutes(end.value) - toMinutes(start.value)
  return {
    entry,
    // ไม่มีค่าระหว่างโหลดรายการของวันนั้น
    dayTotal: others.value && countedOthers.value.reduce((total, log) => total + log.minutes, entry),
  }
})

const errors = computed(() => ({
  date: dateError.value,
  overlap: overlaps.value.length ? 'เวลาซ้อนทับ' : undefined,
  start: startError.value,
  end: endError.value,
  title: requiredError(title.value, 'หัวข้องาน'),
  description: requiredError(description.value, 'รายละเอียด'),
  attachments: checked.value && attachments.value.some(file => file.error)
    ? 'กรุณาลบไฟล์ที่ไม่ผ่านเงื่อนไขก่อนบันทึก'
    : checked.value === 'submit' && !attachments.value.length ? 'กรุณาแนบไฟล์หลักฐานอย่างน้อย 1 ไฟล์' : undefined,
}))

watch([date, startTime, endTime, title, description, attachments], () => {
  if (!pending.value) clear()
})

// ฉบับร่างที่ยังไม่มีเวลาสิ้นสุด กดบันทึกเวลาปัจจุบันได้ (ขอบเขตงานข้อ 7.3)
const isOpenToday = computed(() => isDraftEdit && !isSubmitted.value && !endTime.value.trim() && workDate.value === today)
const canShowFinish = computed(() => isOpenToday.value && !afterWork.value)
// ร่างที่ระบบจับเวลามีคำอธิบายใน timeNotice แล้ว
const afterWorkHint = computed(() => isOpenToday.value && afterWork.value && current.value?.timeSource !== 'timer'
  ? `เลยเวลาเลิกงาน ${workEndTime} น. แล้ว กรอกเวลาที่ทำจริงในช่องเวลาเริ่มและเวลาสิ้นสุด`
  : undefined)
const finishBlock = computed(() => !start.value || startError.value
  ? 'กรอกเวลาเริ่มให้ถูกต้องก่อน จึงจะกด "ทำงานนี้เสร็จสิ้น" ได้'
  : undefined)

// ใช้เวลาของเซิร์ฟเวอร์ และตั้งค่าในฟอร์ม ผู้ใช้ยังต้องกดบันทึกหรือส่งตรวจ
async function finishWork() {
  if (isLocked.value || finishBlock.value) return

  pending.value = 'finish'
  clear()
  try {
    const now = toThaiTimeParts(await api.getServerTime())
    // ให้การตรวจเวลาในฟอร์มใช้เวลาล่าสุดเดียวกับเวลาที่กำลังใส่
    clock.value = now
    const day = workDate.value!
    const from = start.value!

    // งานต้องเสร็จภายในวันเดียวกัน
    const failure = now.date !== day
      ? 'ข้ามวันแล้ว กรุณาโหลดหน้านี้ใหม่เพื่อกรอกเวลาสิ้นสุดเอง'
      : timerFinishError(now.time, props.context) ?? timeRangeError(from, now.time, props.context)
    if (failure) {
      fail(failure, 'บันทึกเวลาสิ้นสุดไม่ได้')
      return
    }
    const overlap = findOverlaps(await api.listWorklogs(day, day), from, now.time, worklogId.value)[0]
    if (overlap) {
      fail(`บันทึกไม่ได้ ${overlapMessage(overlap)}`, 'บันทึกเวลาสิ้นสุดไม่ได้')
      return
    }

    endTime.value = `${now.time} น.`
    done('ใส่เวลาสิ้นสุดแล้ว', `${now.time} น. กดบันทึกฉบับร่างหรือส่งตรวจเพื่อเก็บไว้`)
  }
  catch (error) {
    fail(errorMessage(error))
  }
  finally {
    pending.value = undefined
  }
}

async function save(mode: 'draft' | 'submit') {
  if (isLocked.value) return

  checked.value = mode
  if (Object.values(errors.value).some(Boolean)) {
    fail(errors.value.overlap ? 'บันทึกไม่ได้ เวลาซ้อนทับกับรายการอื่นในวันเดียวกัน' : 'กรุณาตรวจสอบข้อมูลให้ครบและถูกต้อง', mode === 'submit' ? 'ยังส่งตรวจไม่ได้' : 'ยังบันทึกไม่ได้')
    return
  }
  if (start.value && others.value === undefined) {
    fail('ยังตรวจเวลาซ้อนทับไม่เสร็จ กรุณารอสักครู่แล้วลองอีกครั้ง')
    return
  }

  pending.value = mode
  clear()
  try {
    const saved = await api.saveWorklog({
      id: worklogId.value,
      mode: 'backdate',
      date: workDate.value!,
      startTime: start.value,
      endTime: end.value,
      title: title.value,
      description: description.value,
      keepAttachmentIds: attachments.value.filter(file => !file.file).map(file => file.id),
      newFiles: attachments.value.flatMap(file => file.file ? [file.file] : []),
      submit: mode === 'submit',
    })

    worklogId.value = saved.id
    current.value = saved
    isSubmitted.value = saved.reviewStatus === 'submitted'
    attachments.value = saved.attachments ?? []
    if (mode === 'submit') {
      await submitDone(saved, isResubmit ? 'ส่งตรวจใหม่แล้ว' : 'ส่งตรวจแล้ว')
      return
    }
    await refreshSameDay()
    done(isResubmit ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกฉบับร่างแล้ว', isResubmit ? `${saved.title}\nยังไม่ได้ส่งตรวจ` : saved.title)
  }
  catch (error) {
    fail(errorMessage(error))
  }
  finally {
    pending.value = undefined
  }
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
    <form class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" novalidate @submit.prevent>
      <h3 class="text-base font-bold text-slate-900">{{ isEditing ? 'แก้ไขรายการ' : 'รายการย้อนหลัง' }}</h3>

      <p v-if="timeNotice" id="time-notice" class="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
        <UIcon :name="policy.date || policy.end ? 'i-lucide-info' : 'i-lucide-lock'" class="mt-px size-3.5 shrink-0" />
        {{ timeNotice }}
      </p>

      <DateTimeField id="backdate-date" v-model="date" type="date" label="วันที่ทำงาน" :error="errors.date" :readonly="isLocked || !policy.date" />
      <DateTimeField id="backdate-start" v-model="startTime" type="time" label="เวลาเริ่ม" :error="errors.start" :readonly="isLocked || !policy.start" />
      <DateTimeField id="backdate-end" v-model="endTime" type="time" label="เวลาสิ้นสุด" :error="errors.end" :readonly="isLocked || !policy.end" />

      <div class="flex flex-col">
        <label for="backdate-title" class="text-xs font-semibold text-slate-600">หัวข้องาน *</label>
        <input
          id="backdate-title"
          v-model="title"
          type="text"
          required
          :readonly="isLocked"
          :aria-invalid="Boolean(errors.title)"
          class="mt-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-50 aria-invalid:border-red-400"
        >
        <p v-if="errors.title" class="mt-1 text-[11px] font-medium text-red-600">{{ errors.title }}</p>
      </div>

      <div class="flex flex-col">
        <label for="backdate-description" class="text-xs font-semibold text-slate-600">รายละเอียด *</label>
        <textarea
          id="backdate-description"
          v-model="description"
          :rows="isEditing ? 4 : 1"
          required
          :readonly="isLocked"
          :aria-invalid="Boolean(errors.description)"
          class="mt-1.5 resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-700 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-50 aria-invalid:border-red-400"
        />
        <p v-if="errors.description" class="mt-1 text-[11px] font-medium text-red-600">{{ errors.description }}</p>
      </div>

      <section v-if="hours" class="mt-1">
        <h3 class="text-base font-bold text-slate-900">ชั่วโมงการทำงาน</h3>
        <dl class="mt-3 grid gap-4 sm:grid-cols-[1fr_1.4fr_1.8fr]">
          <div>
            <dt class="text-[11px] text-slate-500">ชั่วโมงของรายการนี้</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">{{ formatDuration(hours.entry) }}</dd>
          </div>
          <div>
            <dt class="text-[11px] text-slate-500">รวมทั้งวันที่ {{ workDate ? formatThaiDate(workDate) : date }} (ทุกสถานะ)</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">
              <template v-if="hours.dayTotal !== undefined">{{ formatDuration(hours.dayTotal) }}</template>
              <button v-else-if="sameDayError" type="button" class="text-red-600 underline" @click="refreshSameDay()">โหลดไม่สำเร็จ ลองอีกครั้ง</button>
              <span v-else class="text-slate-500">กำลังโหลด...</span>
            </dd>
          </div>
          <div v-if="policy.date">
            <dt class="text-[11px] text-slate-500">ช่วงวันย้อนหลัง</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">{{ formatThaiDateRange(allowedFrom, allowedTo) }} ({{ earliestDate < windowStart ? 'รวมวันเดิมของรายการ' : `ย้อนหลัง ${backdateLimitDays} วัน` }})</dd>
          </div>
        </dl>

        <template v-if="hours.dayTotal !== undefined">
          <div v-if="countedOthers.length" class="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
            <p class="text-[11px] font-semibold text-slate-600">รายการอื่นในวันเดียวกันที่รวมอยู่ในยอด</p>
            <ul class="mt-1.5 space-y-1.5">
              <li v-for="log in countedOthers" :key="log.id" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                <span class="font-medium text-slate-800">{{ log.title }}</span>
                <span>{{ log.startTime }}–{{ log.endTime }} น. · {{ formatDuration(log.minutes) }}</span>
                <StatusBadge v-bind="reviewStatusMeta[log.reviewStatus]" />
              </li>
            </ul>
          </div>
          <p v-else class="mt-3 text-[11px] text-slate-500">ไม่มีรายการอื่นที่มีเวลาครบในวันที่เลือก</p>
        </template>
      </section>

      <ul v-if="overlaps.length" class="space-y-1 rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700" role="alert">
        <li v-for="log in overlaps" :key="log.id" class="flex items-center gap-1.5">
          <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" />
          {{ overlapMessage(log) }}
        </li>
        <li>บันทึกไม่ได้ กรุณาแก้ไขเวลา</li>
      </ul>

      <p v-if="formError" class="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
        {{ formError }}
      </p>

      <p v-if="canShowFinish && finishBlock" id="finish-hint" class="text-[11px] font-medium text-amber-700">{{ finishBlock }}</p>

      <p v-if="afterWorkHint" class="text-[11px] font-medium text-amber-700">{{ afterWorkHint }}</p>

      <div class="mt-auto flex flex-wrap justify-end gap-3 pt-5">
        <!-- ปุ่มของหน้าที่เรียกใช้ เช่น ลบรายการ -->
        <slot name="secondary-actions" :disabled="Boolean(pending)" :submitted="isSubmitted" />
        <button
          v-if="canShowFinish"
          type="button"
          :disabled="isLocked || Boolean(finishBlock)"
          :aria-describedby="finishBlock ? 'finish-hint' : undefined"
          class="btn btn-done px-3 py-2.5 text-[11px]"
          @click="finishWork"
        >
          {{ pending === 'finish' ? 'กำลังบันทึกเวลา...' : 'ทำงานนี้เสร็จสิ้น (บันทึกเวลาปัจจุบัน)' }}
        </button>
        <button
          type="button"
          :disabled="isLocked"
          class="btn btn-secondary px-3 py-2.5 text-[11px]"
          @click="save('draft')"
        >
          {{ pending === 'draft' ? 'กำลังบันทึก...' : isResubmit ? 'บันทึกการแก้ไข' : 'บันทึกฉบับร่าง' }}
        </button>
        <button
          type="button"
          :disabled="isLocked"
          class="btn btn-primary px-3 py-2.5 text-[11px]"
          @click="save('submit')"
        >
          {{ pending === 'submit' ? 'กำลังส่ง...' : isResubmit ? 'ส่งตรวจใหม่' : 'ส่งตรวจ' }}
        </button>
      </div>
    </form>

    <EvidenceUploader v-model="attachments" :disabled="isLocked" :error="errors.attachments" />
  </div>
</template>
