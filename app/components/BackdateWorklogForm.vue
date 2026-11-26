<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { Attachment, WorkLog, WorklogFormContext } from '~/types/worklog'

const props = defineProps<{
  context: WorklogFormContext
  /** มีค่า = แก้ไขรายการเดิม (ฉบับร่างหรือถูกส่งกลับ) แทนการสร้างรายการใหม่ */
  worklog?: WorkLog
}>()

const api = useApi()
const { today, backdateLimitDays, workEndTime, internshipStart, internshipEnd } = props.context
const isEditing = Boolean(props.worklog)
const isResubmit = props.worklog?.reviewStatus === 'returned'
// ฉบับร่างที่ยังทำไม่เสร็จ บันทึกร่างได้โดยยังไม่มีเวลา แต่ส่งตรวจต้องมีครบ
const isDraftEdit = props.worklog?.reviewStatus === 'draft'
const initial = props.worklog ?? props.context.defaults

const worklogId = ref<number | undefined>(props.worklog?.id)
const date = ref(formatThaiDate(initial.date))
const startTime = ref(initial.startTime ? `${initial.startTime} น.` : '')
const endTime = ref(initial.endTime ? `${initial.endTime} น.` : '')
const title = ref(initial.title)
const description = ref(initial.description ?? '')
const attachments = ref<Attachment[]>((initial.attachments ?? []).map(file => ({ ...file })))
const checked = ref<'draft' | 'submit'>()
const pending = ref<'finish' | 'draft' | 'submit'>()
const isSubmitted = ref(false)
const notice = ref<{ tone: 'error' | 'success', text: string }>()
const isLocked = computed(() => isSubmitted.value || Boolean(pending.value))

// ช่วงวันที่บันทึกย้อนหลังได้ ต้องอยู่ในช่วงฝึกงานด้วย (ขอบเขตงานข้อ 5.6)
const earliestBackdate = addDays(today, -backdateLimitDays)
const allowedFrom = earliestBackdate > internshipStart ? earliestBackdate : internshipStart
const allowedTo = today < internshipEnd ? today : internshipEnd

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
  if (!date.value.trim()) return requiredError(date.value, 'วันที่ทำงาน')

  const value = workDate.value
  if (!value) return 'รูปแบบวันที่ไม่ถูกต้อง (วว-ดด-ปปปป พ.ศ.)'
  if (value > today) return 'ไม่สามารถบันทึกวันที่ในอนาคต'

  const reasons = [
    value < internshipStart || value > internshipEnd ? 'อยู่นอกช่วงฝึกงาน' : undefined,
    value < earliestBackdate ? 'เกินช่วงย้อนหลังที่อนุญาต' : undefined,
  ].filter(Boolean)

  return reasons.length ? reasons.join(' และ') : undefined
})

const timesOptional = computed(() => isDraftEdit && checked.value !== 'submit')

const startError = computed(() => {
  if (!startTime.value.trim()) {
    return timesOptional.value && !endTime.value.trim() ? undefined : requiredError(startTime.value, 'เวลาเริ่ม')
  }
  if (!start.value) return 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)'
  return startTimeError(start.value, workEndTime)
})

const endError = computed(() => {
  if (!endTime.value.trim()) return timesOptional.value ? undefined : requiredError(endTime.value, 'เวลาสิ้นสุด')
  if (!end.value) return 'รูปแบบเวลาไม่ถูกต้อง (ชช:นน)'
  if (!start.value || startError.value) return undefined
  return timeRangeError(start.value, end.value, workEndTime)
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

const hours = computed(() => {
  if (!workDate.value || !start.value || !end.value || dateError.value || startError.value || endError.value) return undefined

  const entry = toMinutes(end.value) - toMinutes(start.value)
  return {
    entry,
    dayTotal: others.value?.reduce((total, log) => log.startTime && log.endTime ? total + toMinutes(log.endTime) - toMinutes(log.startTime) : total, entry),
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
  if (!pending.value) notice.value = undefined
})

// ฉบับร่างที่ยังไม่มีเวลาสิ้นสุด กดบันทึกเวลาปัจจุบันได้ (ขอบเขตงานข้อ 7.3)
const canShowFinish = computed(() => isDraftEdit && !isSubmitted.value && !endTime.value.trim())
const finishBlock = computed(() => {
  if (!start.value || startError.value) return 'กรอกเวลาเริ่มให้ถูกต้องก่อน จึงจะกด "ทำงานนี้เสร็จสิ้น" ได้'
  if (workDate.value !== today) return 'ปุ่ม "ทำงานนี้เสร็จสิ้น" ใช้ได้เฉพาะรายการของวันนี้ รายการวันอื่นให้กรอกเวลาสิ้นสุดเอง'
  return undefined
})

// ใช้เวลาของเซิร์ฟเวอร์ และตั้งค่าในฟอร์ม ผู้ใช้ยังต้องกดบันทึกหรือส่งตรวจ
async function finishWork() {
  if (isLocked.value || finishBlock.value) return

  pending.value = 'finish'
  notice.value = undefined
  try {
    const now = toThaiTimeParts(await api.getServerTime())
    const day = workDate.value!
    const from = start.value!

    // งานต้องเสร็จภายในวันเดียวกัน
    const failure = now.date !== day
      ? 'บันทึกเวลาสิ้นสุดข้ามวันไม่ได้'
      : timeRangeError(from, now.time, workEndTime)
    if (failure) {
      notice.value = { tone: 'error', text: failure }
      return
    }
    const overlap = findOverlaps(await api.listWorklogs(day, day), from, now.time, worklogId.value)[0]
    if (overlap) {
      notice.value = { tone: 'error', text: `บันทึกไม่ได้ ${overlapMessage(overlap)}` }
      return
    }

    endTime.value = `${now.time} น.`
    await nextTick()
    notice.value = { tone: 'success', text: `ใส่เวลาสิ้นสุด ${now.time} น. แล้ว กดบันทึกฉบับร่างหรือส่งตรวจเพื่อเก็บไว้` }
  }
  catch (error) {
    notice.value = { tone: 'error', text: errorMessage(error) }
  }
  finally {
    pending.value = undefined
  }
}

async function save(mode: 'draft' | 'submit') {
  if (isLocked.value) return

  checked.value = mode
  if (Object.values(errors.value).some(Boolean)) {
    notice.value = { tone: 'error', text: errors.value.overlap ? 'บันทึกไม่ได้ เวลาซ้อนทับกับรายการอื่นในวันเดียวกัน' : 'กรุณาตรวจสอบข้อมูลให้ครบและถูกต้อง' }
    return
  }
  if (start.value && others.value === undefined) {
    notice.value = { tone: 'error', text: 'ยังตรวจเวลาซ้อนทับไม่เสร็จ กรุณารอสักครู่แล้วลองอีกครั้ง' }
    return
  }

  pending.value = mode
  notice.value = undefined
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
    isSubmitted.value = saved.reviewStatus === 'submitted'
    attachments.value = saved.attachments ?? []
    await refreshSameDay()
    const savedText = isResubmit ? 'บันทึกการแก้ไขแล้ว (ยังไม่ได้ส่งตรวจ)' : 'บันทึกฉบับร่างแล้ว'
    notice.value = { tone: 'success', text: mode === 'draft' ? savedText : isResubmit ? 'ส่งตรวจใหม่แล้ว' : 'ส่งตรวจแล้ว' }
  }
  catch (error) {
    notice.value = { tone: 'error', text: errorMessage(error) }
  }
  finally {
    pending.value = undefined
  }
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
    <form class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" novalidate @submit.prevent>
      <h3 class="text-base font-semibold text-slate-900">{{ isEditing ? 'แก้ไขรายการ' : 'รายการย้อนหลัง' }}</h3>

      <DateTimeField id="backdate-date" v-model="date" type="date" label="วันที่ทำงาน" :error="errors.date" :readonly="isLocked" />
      <DateTimeField id="backdate-start" v-model="startTime" type="time" label="เวลาเริ่ม" :error="errors.start" :readonly="isLocked" />
      <DateTimeField id="backdate-end" v-model="endTime" type="time" label="เวลาสิ้นสุด" :error="errors.end" :readonly="isLocked" />

      <div class="flex flex-col">
        <label for="backdate-title" class="text-xs font-semibold text-slate-600">หัวข้องาน *</label>
        <input
          id="backdate-title"
          v-model="title"
          type="text"
          required
          :readonly="isLocked"
          :aria-invalid="Boolean(errors.title)"
          class="mt-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-50 aria-invalid:border-red-400"
        >
        <p v-if="errors.title" class="mt-1 text-[11px] font-medium text-red-500">{{ errors.title }}</p>
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
          class="mt-1.5 resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-50 aria-invalid:border-red-400"
        />
        <p v-if="errors.description" class="mt-1 text-[11px] font-medium text-red-500">{{ errors.description }}</p>
      </div>

      <section v-if="hours" class="mt-1">
        <h3 class="text-base font-semibold text-slate-900">ชั่วโมงการทำงาน</h3>
        <dl class="mt-3 grid gap-4 sm:grid-cols-[1fr_1.4fr_1.8fr]">
          <div>
            <dt class="text-[11px] text-slate-400">รายการนี้</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">{{ formatDuration(hours.entry) }}</dd>
          </div>
          <div>
            <dt class="text-[11px] text-slate-400">รวมในวันที่เลือก (หลังบันทึก)</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">
              <template v-if="hours.dayTotal !== undefined">{{ formatDuration(hours.dayTotal) }}</template>
              <button v-else-if="sameDayError" type="button" class="text-red-500 underline" @click="refreshSameDay()">โหลดไม่สำเร็จ ลองอีกครั้ง</button>
              <span v-else class="text-slate-400">กำลังโหลด...</span>
            </dd>
          </div>
          <div>
            <dt class="text-[11px] text-slate-400">ช่วงวันย้อนหลัง</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">{{ formatThaiDateRange(allowedFrom, allowedTo) }} (ย้อนหลัง {{ backdateLimitDays }} วัน)</dd>
          </div>
        </dl>
      </section>

      <ul v-if="overlaps.length" class="space-y-1 rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600" role="alert">
        <li v-for="log in overlaps" :key="log.id" class="flex items-center gap-1.5">
          <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" />
          {{ overlapMessage(log) }}
        </li>
        <li>บันทึกไม่ได้ กรุณาแก้ไขเวลา</li>
      </ul>

      <p
        v-if="notice"
        class="rounded-lg px-3 py-2 text-[11px] font-medium"
        :class="notice.tone === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'"
        role="status"
      >
        {{ notice.text }}
      </p>

      <p v-if="canShowFinish && finishBlock" id="finish-hint" class="text-[11px] font-medium text-amber-700">{{ finishBlock }}</p>

      <div class="mt-auto flex flex-wrap justify-end gap-3 pt-5">
        <button
          v-if="canShowFinish"
          type="button"
          :disabled="isLocked || Boolean(finishBlock)"
          :aria-describedby="finishBlock ? 'finish-hint' : undefined"
          class="rounded-lg bg-emerald-700 px-3 py-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          @click="finishWork"
        >
          {{ pending === 'finish' ? 'กำลังบันทึกเวลา...' : 'ทำงานนี้เสร็จสิ้น (บันทึกเวลาปัจจุบัน)' }}
        </button>
        <button
          type="button"
          :disabled="isLocked"
          class="rounded-lg bg-indigo-600 px-3 py-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          @click="save('draft')"
        >
          {{ pending === 'draft' ? 'กำลังบันทึก...' : isResubmit ? 'บันทึกการแก้ไข' : 'บันทึกฉบับร่าง' }}
        </button>
        <button
          type="button"
          :disabled="isLocked"
          class="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          @click="save('submit')"
        >
          {{ pending === 'submit' ? 'กำลังส่ง...' : isResubmit ? 'ส่งตรวจใหม่' : 'ส่งตรวจ' }}
        </button>
      </div>
    </form>

    <EvidenceUploader v-model="attachments" :disabled="isLocked" :error="errors.attachments" />
  </div>
</template>
