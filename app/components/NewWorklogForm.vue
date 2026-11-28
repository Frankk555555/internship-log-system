<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { Attachment, ReviewStatus, WorkStatus, WorklogFormContext } from '~/types/worklog'

const props = defineProps<{
  context: WorklogFormContext
}>()

const api = useApi()
const submitDone = useSubmitDone()
const defaults = props.context.defaults
const startTime = defaults.startTime!
const { workEndTime } = props.context
// เริ่มงานใหม่ไม่ได้ ถ้าอยู่นอกเวลางาน หรือยังมีงานอื่นจับเวลาอยู่ (ตรวจตอนเปิดฟอร์ม)
const running = props.context.runningWorklog
const outsideHours = timerStartError(startTime, props.context)
const noMentor = props.context.hasMentor ? undefined : noMentorMessage
const blocked = noMentor ?? outsideHours ?? (running
  ? `เริ่มงานใหม่ไม่ได้ ยังมีงานกำลังดำเนินการอยู่: “${running.title}” (เริ่ม ${running.startTime} น.)`
  : undefined)

const worklogId = ref<number>()
const title = ref(defaults.title)
const description = ref(defaults.description)
const attachments = ref<Attachment[]>(defaults.attachments.map(file => ({ ...file })))
const endTime = ref(defaults.endTime)
const reviewStatus = ref<ReviewStatus>('draft')
const checked = ref<'draft' | 'submit'>()
const pending = ref<'finish' | 'draft' | 'submit'>()
const { error: formError, clear, fail, done } = useFormNotice()

const workStatus = computed<WorkStatus>(() => endTime.value ? 'done' : 'in_progress')
const isSubmitted = computed(() => reviewStatus.value === 'submitted')
const isLocked = computed(() => isSubmitted.value || Boolean(pending.value))
const canSubmit = computed(() => Boolean(endTime.value) && !isLocked.value && !blocked)

// เปิดฟอร์มค้างไว้จนเลยเวลาเลิกงาน ต้องกรอกเวลาสิ้นสุดเองในหน้าแก้ไข
const clock = useServerClock()
const afterWork = computed(() => Boolean(clock.value) && isAfterWork(clock.value!.time, workEndTime))
const missedFinish = computed(() => afterWork.value && !endTime.value && !isSubmitted.value)

// ทางไปต่อเมื่อทำในฟอร์มนี้ไม่ได้
const nextStep = computed(() => {
  // ต้องรอแอดมินกำหนดพี่เลี้ยง ไม่มีหน้าให้ไปต่อ
  if (noMentor) return undefined
  if (outsideHours) {
    // ก่อนเวลาเข้างานต้องรอ ไม่มีหน้าให้ไปต่อ
    if (toMinutes(startTime) < toMinutes(workEndTime)) return undefined
    return running
      ? { to: `/worklogs/${running.id}/edit`, label: 'ไปกรอกเวลาสิ้นสุดของงานที่ค้าง' }
      : { to: '/worklogs/backdate', label: 'ไปบันทึกย้อนหลัง' }
  }
  if (running) return { to: `/worklogs/${running.id}/edit`, label: afterWork.value ? 'ไปกรอกเวลาสิ้นสุดของงานนั้น' : 'ไปจบงานนั้นก่อน' }
  return missedFinish.value && worklogId.value ? { to: `/worklogs/${worklogId.value}/edit`, label: 'กรอกเวลาสิ้นสุด' } : undefined
})

const errors = computed(() => ({
  title: checked.value && !title.value.trim() ? 'กรุณากรอกหัวข้องาน' : undefined,
  description: checked.value && !description.value.trim() ? 'กรุณากรอกรายละเอียด' : undefined,
  attachments: checked.value && attachments.value.some(file => file.error)
    ? 'กรุณาลบไฟล์ที่ไม่ผ่านเงื่อนไขก่อนบันทึก'
    : checked.value === 'submit' && !attachments.value.length ? 'กรุณาแนบไฟล์หลักฐานอย่างน้อย 1 ไฟล์' : undefined,
}))

const hint = computed(() => {
  if (blocked) return blocked
  if (isSubmitted.value) return 'ส่งตรวจแล้ว ไม่สามารถแก้ไขรายการนี้ได้'
  if (endTime.value) return 'บันทึกเวลาสิ้นสุดแล้ว สามารถกด "ส่งตรวจ" ได้'
  if (afterWork.value) {
    return worklogId.value
      ? `เลยเวลาเลิกงาน ${workEndTime} น. แล้ว กรอกเวลาที่ทำเสร็จจริงในหน้าแก้ไขรายการ`
      : `เลยเวลาเลิกงาน ${workEndTime} น. แล้ว กด "บันทึกฉบับร่าง" ก่อน แล้วจึงกรอกเวลาที่ทำเสร็จจริง`
  }
  return `ปุ่ม "ส่งตรวจ" จะใช้งานได้เมื่อกด "ทำงานนี้เสร็จสิ้น" แล้วเท่านั้น (ต้องเสร็จภายใน ${workEndTime} น. ของวันนี้)`
})

watch([title, description, attachments], () => {
  if (!pending.value) clear()
})

/** ตรวจเวลาซ้อนกับรายการอื่นของวันเดียวกัน (ดึงข้อมูลล่าสุดทุกครั้ง) */
async function overlapError(until?: string) {
  const sameDay = await api.listWorklogs(defaults.date, defaults.date)
  const overlap = findOverlaps(sameDay, startTime, until, worklogId.value)[0]
  return overlap ? `บันทึกไม่ได้ ${overlapMessage(overlap)}` : undefined
}

// ใช้เวลาของเซิร์ฟเวอร์ ไม่ใช่นาฬิกาเครื่องผู้ใช้
async function finishWork() {
  pending.value = 'finish'
  clear()
  try {
    const now = toThaiTimeParts(await api.getServerTime())

    // งานต้องเสร็จภายในวันเดียวกัน
    const dateError = now.date === defaults.date ? undefined : 'บันทึกเวลาสิ้นสุดข้ามวันไม่ได้ กรุณาสร้างรายการใหม่ของวันนี้'
    const failure = dateError ?? timerFinishError(now.time, props.context)
      ?? timeRangeError(startTime, now.time, props.context) ?? await overlapError(now.time)
    if (failure) {
      fail(failure, 'บันทึกเวลาสิ้นสุดไม่ได้')
      return
    }
    endTime.value = now.time
    done('ใส่เวลาสิ้นสุดแล้ว', `${now.time} น. กดบันทึกฉบับร่างหรือส่งตรวจเพื่อเก็บไว้`)
  }
  catch (error) {
    fail(errorMessage(error))
  }
  finally {
    pending.value = undefined
  }
}

const root = useTemplateRef<HTMLElement>('root')

async function save(mode: 'draft' | 'submit') {
  if (pending.value || (mode === 'submit' && !canSubmit.value)) return

  if (blocked) return

  checked.value = mode
  if (Object.values(errors.value).some(Boolean)) {
    fail('กรุณาตรวจสอบข้อมูลให้ครบและถูกต้อง', mode === 'submit' ? 'ยังส่งตรวจไม่ได้' : 'ยังบันทึกไม่ได้')
    await focusFirstInvalid(root.value)
    return
  }

  pending.value = mode
  clear()
  try {
    const overlap = await overlapError(endTime.value)
    if (overlap) {
      fail(overlap)
      return
    }

    const saved = await api.saveWorklog({
      id: worklogId.value,
      mode: 'new',
      date: defaults.date,
      startTime,
      endTime: endTime.value,
      title: title.value,
      description: description.value,
      keepAttachmentIds: attachments.value.filter(file => !file.file).map(file => file.id),
      newFiles: attachments.value.flatMap(file => file.file ? [file.file] : []),
      submit: mode === 'submit',
    })

    // เก็บ id ไว้ การบันทึกครั้งต่อไปจะแก้รายการเดิม ไม่สร้างซ้ำ
    worklogId.value = saved.id
    reviewStatus.value = saved.reviewStatus
    attachments.value = saved.attachments ?? []
    if (mode === 'submit') {
      await submitDone(saved, 'ส่งตรวจแล้ว')
      return
    }
    done('บันทึกฉบับร่างแล้ว', saved.title)
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
  <div ref="root" class="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
    <div class="flex flex-col gap-2">
      <form class="flex flex-1 flex-col card p-5" novalidate @submit.prevent>
        <h2 class="text-base font-bold text-ink">รายละเอียดงาน</h2>

        <label for="worklog-title" class="mt-4 text-xs font-semibold text-slate-600">หัวข้องาน *</label>
        <input
          id="worklog-title"
          v-model="title"
          type="text"
          required
          :readonly="isLocked"
          :aria-invalid="Boolean(errors.title)"
          :aria-describedby="errors.title ? 'worklog-title-error' : undefined"
          class="field mt-1.5 px-3 py-2 text-xs"
        >
        <p v-if="errors.title" id="worklog-title-error" class="mt-1 field-error">{{ errors.title }}</p>

        <label for="worklog-description" class="mt-3 text-xs font-semibold text-slate-600">รายละเอียด *</label>
        <textarea
          id="worklog-description"
          v-model="description"
          rows="5"
          required
          :readonly="isLocked"
          :aria-invalid="Boolean(errors.description)"
          :aria-describedby="errors.description ? 'worklog-description-error' : undefined"
          class="field mt-1.5 resize-y px-3 py-2 text-xs leading-relaxed"
        />
        <p v-if="errors.description" id="worklog-description-error" class="mt-1 field-error">{{ errors.description }}</p>

        <h2 class="mt-4 text-base font-bold text-ink">บันทึกเวลาอัตโนมัติ</h2>
        <dl class="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-[1fr_1fr_1.7fr_1.6fr]">
          <div>
            <dt class="text-2xs text-ink-muted">วันที่บันทึก</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">{{ formatThaiDate(defaults.date) }}</dd>
          </div>
          <div>
            <dt class="text-2xs text-ink-muted">เริ่มทำงาน</dt>
            <dd class="mt-1">
              <span class="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{{ startTime }} น.</span>
            </dd>
          </div>
          <div>
            <dt class="text-2xs text-ink-muted">เวลาสิ้นสุดจริง</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">{{ endTime ? `${endTime} น.` : 'บันทึกเมื่อกดทำงานนี้เสร็จสิ้น' }}</dd>
          </div>
          <div>
            <dt class="text-2xs text-ink-muted">ความคืบหน้า / การตรวจ</dt>
            <dd class="mt-1 text-xs font-semibold text-slate-800">{{ workStatusMeta[workStatus].label }} / {{ reviewStatusMeta[reviewStatus].label }}</dd>
          </div>
        </dl>

        <p v-if="formError" class="mt-4 notice-error">
          {{ formError }}
        </p>

        <div class="mt-auto flex flex-wrap justify-end gap-3 pt-10">
          <button
            type="button"
            :disabled="Boolean(endTime) || isLocked || Boolean(blocked) || afterWork"
            class="btn btn-done px-3 py-2.5 text-2xs"
            @click="finishWork"
          >
            {{ pending === 'finish' ? 'กำลังบันทึกเวลา...' : 'ทำงานนี้เสร็จสิ้น (บันทึกเวลาปัจจุบัน)' }}
          </button>
          <button
            type="button"
            :disabled="isLocked || Boolean(blocked)"
            class="btn btn-secondary px-3 py-2.5 text-2xs"
            @click="save('draft')"
          >
            {{ pending === 'draft' ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง' }}
          </button>
          <button
            type="button"
            :disabled="!canSubmit"
            class="btn btn-primary px-3 py-2.5 text-2xs"
            @click="save('submit')"
          >
            {{ pending === 'submit' ? 'กำลังส่ง...' : 'ส่งตรวจ' }}
          </button>
        </div>
      </form>

      <p class="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-4 py-3 text-center text-2xs font-medium text-amber-700">
        <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" />
        <span>
          {{ hint }}
          <NuxtLink v-if="nextStep" :to="nextStep.to" class="ml-1 link">
            {{ nextStep.label }}
          </NuxtLink>
        </span>
      </p>
    </div>

    <EvidenceUploader v-model="attachments" :disabled="isLocked" :error="errors.attachments" />
  </div>
</template>
