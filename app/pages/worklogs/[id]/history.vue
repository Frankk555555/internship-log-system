<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { HistoryEvent } from '~/types/worklog'

// นักศึกษาและพี่เลี้ยงใช้หน้านี้ เลือกเมนูข้างตามบทบาท
definePageMeta({
  role: ['student', 'supervisor'],
  middleware: [() => {
    setPageLayout(layoutFor(useSessionUser().value?.role))
  }],
})

useHead({ title: 'ประวัติงานและการแก้ไข' })

const route = useRoute()
const api = useApi()
const worklogId = Number(route.params.id)
const user = useSessionUser()
const isMentor = computed(() => user.value?.role === 'supervisor')

const { data, status, error, refresh } = await useLazyAsyncData(`worklog-history-${worklogId}`, () => api.getWorklogHistory(worklogId))

// รายการนอกสิทธิ์ แสดงหน้าแจ้งว่าเข้าถึงไม่ได้
watch(error, async (failure) => {
  if (failure?.statusCode === 403) await navigateTo('/forbidden', { replace: true })
}, { immediate: true })

const events = computed(() => (data.value?.events ?? []).map(event => ({ ...event, at: toThaiTimeParts(event.changedAt) })))

// จัดกลุ่มตามวัน วันที่จึงแสดงครั้งเดียว (events เรียงจากใหม่ไปเก่าแล้ว)
const days = computed(() => {
  const groups: { date: string, events: typeof events.value }[] = []
  for (const event of events.value) {
    const last = groups.at(-1)
    if (last?.date === event.at.date) last.events.push(event)
    else groups.push({ date: event.at.date, events: [event] })
  }
  return groups
})

// ไอคอนและสีตามชนิดเหตุการณ์ ชุดเดียวกับการแจ้งเตือน
const kinds: Record<HistoryEvent['type'], { icon: string, tone: string }> = {
  status: { icon: 'i-lucide-arrow-right', tone: 'bg-slate-100 text-slate-600' },
  edit: { icon: 'i-lucide-pencil-line', tone: 'bg-indigo-100 text-brand' },
  return: { icon: 'i-lucide-rotate-ccw', tone: 'bg-rose-100 text-rose-700' },
  approval: { icon: 'i-lucide-check', tone: 'bg-emerald-100 text-emerald-700' },
  delete: { icon: 'i-lucide-trash-2', tone: 'bg-red-100 text-red-700' },
}

// ค่าเริ่มต้นเลือกการลบ ถ้าไม่มีเลือกการแก้ไขข้อมูลครั้งล่าสุด
const pickedId = ref<number>()
const selected = computed(() => events.value.find(event => event.id === pickedId.value)
  ?? events.value.find(event => event.type === 'delete')
  ?? events.value.find(event => event.type === 'edit')
  ?? events.value[0])

const detail = useTemplateRef<HTMLElement>('detail')

async function pick(id: number) {
  pickedId.value = id
  // จอแคบ รายละเอียดอยู่ใต้รายการ เลื่อนให้เห็นหลังเลือก
  if (window.matchMedia('(min-width: 1024px)').matches) return
  await nextTick()
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  detail.value?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' })
}

const worklog = computed(() => data.value?.worklog)
const reviewStatus = computed(() => worklog.value?.reviewStatus)
const isApproved = computed(() => reviewStatus.value === 'approved')
const deletion = computed(() => worklog.value?.deletion)

// ตัวเลขหลักของรายการ
const timeLabel = computed(() => {
  const { startTime, endTime } = worklog.value ?? {}
  if (!startTime) return 'ยังไม่เริ่ม'
  return endTime ? `${startTime}–${endTime} น.` : `เริ่ม ${startTime} น.`
})
const durationLabel = computed(() => {
  const { startTime, endTime } = worklog.value ?? {}
  return startTime && endTime ? formatDuration(toMinutes(endTime) - toMinutes(startTime)) : '–'
})

function dateTimeLabel(value: string) {
  const { date, time } = toThaiTimeParts(value)
  return `${formatThaiDate(date)} • ${time} น.`
}

// รายการที่เลยกำหนดแก้ไขเปิดหน้าแก้ไขจากเมนูไม่ได้ จึงต้องลบจากหน้านี้ได้ (ขอบเขตงานข้อ 8.4)
const canDelete = computed(() => !isMentor.value && !deletion.value && ['draft', 'returned'].includes(reviewStatus.value ?? ''))
const notify = useNotify()
const isDeleteOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string>()

function askDelete() {
  deleteError.value = undefined
  isDeleteOpen.value = true
}

async function deleteLog(reason: string) {
  const target = data.value?.worklog
  if (!target || isDeleting.value) return

  isDeleting.value = true
  deleteError.value = undefined
  try {
    await api.deleteWorklog(target.id, reason)
    isDeleteOpen.value = false
    notify('success', 'ลบรายการแล้ว', target.title)
    // อยู่หน้าเดิม ให้เห็นผู้ลบ เวลา และเหตุผลที่บันทึกไว้
    pickedId.value = undefined
    await refresh()
  }
  catch (failure) {
    deleteError.value = errorMessage(failure)
    notify('error', 'ลบรายการไม่สำเร็จ', deleteError.value)
  }
  finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      class="mb-5"
      title="ประวัติงานและการแก้ไข"
      description="ตรวจสอบผู้แก้ไข เวลา และข้อมูลก่อน–หลัง"
      :crumbs="[
        { label: isMentor ? 'พื้นที่พี่เลี้ยง' : 'พื้นที่นักศึกษา' },
        isMentor ? { label: 'ตรวจงานนักศึกษา', to: '/mentor/reviews' } : { label: 'บันทึกงานประจำวัน', to: '/worklogs' },
        { label: 'ดูประวัติ' },
      ]"
    >
      <template #back>
        <BackButton :fallback="isMentor ? '/mentor/reviews' : '/worklogs'" />
      </template>
    </PageHeader>

    <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
      <template v-if="worklog && reviewStatus">
        <!-- รายการที่กำลังดู: ชื่อ สถานะปัจจุบัน และตัวเลขหลัก -->
        <section class="card overflow-hidden" aria-labelledby="entry-title">
          <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-5">
            <div class="min-w-0 flex-1 basis-72">
              <div class="flex flex-wrap items-center gap-1.5">
                <StatusBadge v-if="deletion" label="ถูกลบ" tone="rose" />
                <StatusBadge v-else v-bind="reviewStatusMeta[reviewStatus]" />
                <TimeFlagBadges :worklog="worklog" />
              </div>
              <h2 id="entry-title" class="mt-2 break-words text-xl font-bold leading-snug text-ink">{{ worklog.title }}</h2>

              <dl class="mt-4 flex flex-wrap gap-x-10 gap-y-3 tabular-nums">
                <div>
                  <dt class="text-2xs text-ink-muted">วันที่ทำงาน</dt>
                  <dd class="mt-0.5 text-base font-bold text-ink">{{ formatThaiDate(worklog.date) }}</dd>
                </div>
                <div>
                  <dt class="text-2xs text-ink-muted">เวลา</dt>
                  <dd class="mt-0.5 text-base font-bold text-ink">{{ timeLabel }}</dd>
                </div>
                <div>
                  <dt class="text-2xs text-ink-muted">ระยะเวลา</dt>
                  <dd class="mt-0.5 text-base font-bold text-ink">{{ durationLabel }}</dd>
                </div>
              </dl>
            </div>

            <button v-if="canDelete" type="button" class="btn btn-danger-outline px-3 py-2 text-2xs" @click="askDelete">
              ลบรายการ
            </button>
            <p v-else-if="isApproved && !deletion" class="flex items-center gap-1.5 text-xs text-ink-muted">
              <UIcon name="i-lucide-lock" class="size-3.5 shrink-0" />
              รายการที่อนุมัติแล้วเปิดดูได้อย่างเดียว
            </p>
          </div>

          <div v-if="deletion" class="border-t border-red-200 bg-red-50 px-5 py-3 text-xs text-red-700">
            <p class="font-semibold">รายการนี้ถูกลบแล้ว</p>
            <p class="mt-1 break-words text-sm font-semibold">เหตุผล: {{ deletion.reason }}</p>
            <p class="mt-1">ลบโดย {{ deletion.deletedBy }} เมื่อ {{ dateTimeLabel(deletion.deletedAt) }}</p>
          </div>
        </section>

        <div class="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section class="card p-5">
            <h2 class="text-base font-bold text-ink">ประวัติรายการ</h2>

            <ol v-if="days.length" class="mt-4 space-y-5">
              <li v-for="day in days" :key="day.date">
                <h3 class="border-b border-line pb-1.5 text-xs font-bold tabular-nums text-ink">{{ formatThaiDate(day.date) }}</h3>
                <ol class="mt-1.5 space-y-1">
                  <li v-for="event in day.events" :key="event.id">
                    <button
                      type="button"
                      class="grid w-full grid-cols-[4rem_1.75rem_minmax(0,1fr)] items-start gap-2.5 rounded-lg px-2 py-2 text-left transition"
                      :class="event.id === selected?.id ? 'bg-page ring-2 ring-brand' : 'hover:bg-page'"
                      :aria-pressed="event.id === selected?.id"
                      @click="pick(event.id)"
                    >
                      <span class="pt-1 text-[0.8125rem] font-bold tabular-nums text-ink">
                        <span class="sr-only">{{ formatThaiDate(event.at.date) }} </span>{{ event.at.time }} น.
                      </span>
                      <span class="flex size-7 items-center justify-center rounded-full" :class="kinds[event.type].tone" aria-hidden="true">
                        <UIcon :name="kinds[event.type].icon" class="size-3.5" />
                      </span>
                      <span class="min-w-0">
                        <span class="line-clamp-2 break-words text-[0.8125rem] font-semibold leading-snug text-ink">{{ event.title }}</span>
                        <span class="mt-0.5 block text-2xs text-slate-600">{{ event.actorName }}</span>
                      </span>
                    </button>
                  </li>
                </ol>
              </li>
            </ol>
            <p v-else class="py-12 text-center text-sm text-ink-muted">ยังไม่มีประวัติของรายการนี้</p>
          </section>

          <!-- รายละเอียดของเหตุการณ์ที่เลือก จอกว้างเลื่อนตามเมื่อรายการยาว -->
          <section v-if="selected" ref="detail" class="card scroll-mt-20 p-5 lg:sticky lg:top-4" aria-label="รายละเอียดการแก้ไข" aria-live="polite">
            <div class="flex items-start gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full" :class="kinds[selected.type].tone" aria-hidden="true">
                <UIcon :name="kinds[selected.type].icon" class="size-4" />
              </span>
              <div class="min-w-0">
                <h2 class="break-words text-base font-bold leading-snug text-ink">{{ selected.title }}</h2>
                <dl class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                  <div>
                    <dt class="sr-only">ผู้แก้ไข</dt>
                    <dd class="font-semibold">{{ selected.actorName }}</dd>
                  </div>
                  <div>
                    <dt class="sr-only">วันที่และเวลา</dt>
                    <dd class="tabular-nums">{{ formatThaiDate(selected.at.date) }} • {{ selected.at.time }} น.</dd>
                  </div>
                </dl>
              </div>
            </div>

            <dl class="mt-5 space-y-2">
              <div class="rounded-lg bg-page px-4 py-3">
                <dt class="text-2xs font-semibold text-slate-600">ก่อนแก้ไข</dt>
                <dd class="mt-1 break-words text-sm text-slate-600">{{ selected.before }}</dd>
              </div>
              <div class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
                <dt class="flex items-center gap-1 text-2xs font-semibold text-brand">
                  <UIcon name="i-lucide-arrow-down" class="size-3" />
                  หลังแก้ไข
                </dt>
                <dd class="mt-1 break-words text-base font-bold text-ink">{{ selected.after }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </template>
    </AsyncState>

    <DeleteWorklogModal
      v-model:open="isDeleteOpen"
      :log="data?.worklog"
      :pending="isDeleting"
      :server-error="deleteError"
      @confirm="deleteLog"
    />
  </div>
</template>
