<script setup lang="ts">
import { ApiError, errorMessage } from '~/services/api'
import type { ReviewItem } from '~/types/review'

definePageMeta({ layout: 'staff', role: 'admin' })
useHead({ title: 'อนุมัติแทนพี่เลี้ยง' })

const pageSize = 5
const api = useApi()
const notify = useNotify()

// เปิดพร้อมเลือกพี่เลี้ยงได้ เช่น ?mentor=5
const route = useRoute()
const mentorId = ref(Number(route.query.mentor) || undefined)
const limit = ref(pageSize)

const { data, status, error, refresh } = await useLazyAsyncData(
  'proxy-queue',
  async () => {
    const requested = mentorId.value
    return { requested, queue: await api.getProxyQueue(limit.value, requested) }
  },
  { watch: [mentorId, limit] },
)

// แสดงเฉพาะข้อมูลของพี่เลี้ยงที่เลือกอยู่
const queue = computed(() => data.value && data.value.requested === mentorId.value ? data.value.queue : undefined)
const current = computed(() => queue.value?.selected)

// เก็บรายการตามที่เห็นตอนเลือก (รวม version) ถ้าถูกแก้หลังจากนั้น การอนุมัติจะไม่ผ่าน (10.3)
const selected = ref<ReviewItem[]>([])
const selectedHours = computed(() => formatHours(selected.value.reduce((total, item) => total + reviewMinutes(item), 0)))

function toggle(item: ReviewItem) {
  selected.value = selected.value.some(other => other.worklog.id === item.worklog.id)
    ? selected.value.filter(other => other.worklog.id !== item.worklog.id)
    : [...selected.value, item]
}

function toggleAll(items: ReviewItem[], checked: boolean) {
  const ids = new Set(items.map(item => item.worklog.id))
  const others = selected.value.filter(item => !ids.has(item.worklog.id))
  selected.value = checked ? [...others, ...items] : others
}

// ข้อความที่ค้างไว้ในหน้าจนกว่าจะปิดหรือทำรายการใหม่
const problems = ref<{ title: string, messages: string[] }>()

const mentorChoice = computed({
  // ยังโหลดอยู่แสดงคนที่เพิ่งเลือก
  get: () => String(queue.value ? queue.value.selected?.mentorId ?? '' : mentorId.value ?? ''),
  set: (value: string) => {
    mentorId.value = Number(value)
    limit.value = pageSize
    selected.value = []
    problems.value = undefined
  },
})
// รายชื่อคงไว้ระหว่างโหลด ช่องเลือกจึงไม่กระพริบ
const mentorOptions = computed(() => (data.value?.queue.mentors ?? []).map(({ id, name }) => ({ value: String(id), label: name })))

function dateTimeLabel(value: string) {
  const { date, time } = toThaiTimeParts(value)
  return `${formatThaiDate(date)} • ${time} น.`
}

const viewing = ref<ReviewItem>()
const isReviewOpen = ref(false)
const pending = ref(false)
const failure = ref<string>()

function openReview(item: ReviewItem) {
  viewing.value = item
  failure.value = undefined
  isReviewOpen.value = true
}

async function approve(items: ReviewItem[], comment?: string) {
  const mentor = current.value
  if (!mentor || pending.value || !items.length) return

  pending.value = true
  failure.value = undefined
  problems.value = undefined
  try {
    const targets = items.map(({ worklog }) => ({ id: worklog.id, version: worklog.version ?? 0 }))
    const result = await api.approveByProxy(mentor.mentorId, targets, comment || undefined)

    const succeeded = items.filter(item => result.succeededIds.includes(item.worklog.id))
    if (succeeded.length) {
      const hours = formatHours(succeeded.reduce((total, item) => total + reviewMinutes(item), 0))
      notify('success', `อนุมัติแทน ${succeeded.length} รายการแล้ว`, `แทน${mentor.mentorName} · ${hours} ชม.\nนักศึกษาและพี่เลี้ยงได้รับแจ้ง`)
    }
    if (result.failures.length) {
      const lines = result.failures.map((problem) => {
        const title = items.find(item => item.worklog.id === problem.id)?.worklog.title
        return `${title}: ${problem.message}`
      })
      problems.value = { title: `ทำรายการไม่สำเร็จ ${result.failures.length} รายการ`, messages: lines }
      notify('error', problems.value.title, lines.join('\n'))
    }

    selected.value = selected.value.filter(item => !targets.some(target => target.id === item.worklog.id))
    isReviewOpen.value = false
    await refresh()
  }
  catch (problem) {
    const message = errorMessage(problem)
    notify('error', 'อนุมัติแทนไม่สำเร็จ', message)
    // ช่วงไม่อยู่หมดระหว่างเปิดหน้า ค้างข้อความไว้และโหลดคิวใหม่
    if (problem instanceof ApiError && problem.statusCode === 403) {
      isReviewOpen.value = false
      selected.value = []
      problems.value = { title: 'อนุมัติแทนไม่สำเร็จ', messages: [message] }
      await refresh()
    }
    else if (isReviewOpen.value) failure.value = message
    else problems.value = { title: 'อนุมัติแทนไม่สำเร็จ', messages: [message] }
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="อนุมัติแทนพี่เลี้ยง"
      description="อนุมัติได้เฉพาะงานของนักศึกษาในความดูแลของพี่เลี้ยงที่ไม่อยู่ และเฉพาะในช่วงที่บันทึกไว้"
      :crumbs="[{ label: 'พื้นที่แอดมิน' }, { label: 'อนุมัติแทน' }]"
    />

    <ErrorNotice v-if="problems" v-bind="problems" class="mt-4" @close="problems = undefined" />

    <div class="mt-4">
      <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
        <div v-if="data && !data.queue.mentors.length" class="card px-5 py-12 text-center">
          <p class="text-sm font-semibold text-slate-700">ตอนนี้ไม่มีพี่เลี้ยงที่ไม่อยู่</p>
          <p class="mt-1 text-xs text-ink-muted">อนุมัติแทนได้เฉพาะช่วงที่บันทึกว่าพี่เลี้ยงไม่อยู่</p>
          <NuxtLink to="/admin/mentor-absences" class="btn btn-secondary mt-4 inline-flex px-4 py-2 text-xs">ไปหน้าพี่เลี้ยงไม่อยู่</NuxtLink>
        </div>

        <template v-else-if="data">
          <div class="flex flex-col gap-3 md:flex-row md:items-end">
            <div class="md:w-[16.5rem] md:shrink-0">
              <SelectField id="proxy-mentor" v-model="mentorChoice" label="พี่เลี้ยงที่ไม่อยู่" :options="mentorOptions" :disabled="pending" />
            </div>
            <div v-if="current" class="flex min-w-0 items-center gap-2 rounded-lg bg-amber-100 px-3 py-1 text-amber-800 md:min-h-10">
              <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" />
              <div class="min-w-0 leading-snug">
                <p class="text-xs font-bold tabular-nums">อนุมัติแทนได้ถึง {{ dateTimeLabel(current.endAt) }}</p>
                <p class="break-words text-2xs">ไม่อยู่ตั้งแต่ {{ dateTimeLabel(current.startAt) }} เหตุผล {{ current.reason }} ทุกรายการบันทึกว่าแอดมินอนุมัติแทน</p>
              </div>
            </div>
          </div>

          <p v-if="!queue" class="card mt-4 px-5 py-12 text-center text-sm text-ink-muted" role="status">กำลังโหลดข้อมูล...</p>

          <section v-else class="card mt-4 overflow-hidden" aria-labelledby="proxy-queue-title">
            <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div class="flex flex-wrap items-center gap-2">
                <h2 id="proxy-queue-title" class="text-base font-bold text-ink">งานรอตรวจ</h2>
                <StatusBadge :label="`${queue.total} รายการ`" :tone="queue.total ? 'amber' : 'slate'" />
                <StatusBadge v-if="queue.overdueCount" :label="`ค้างเกิน ${queue.overdueDays} วัน ${queue.overdueCount}`" tone="rose" />
              </div>
              <div v-if="queue.total" class="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <p class="text-xs tabular-nums text-slate-600" role="status">
                  เลือกแล้ว {{ selected.length }} รายการ<span v-if="selected.length"> รวม {{ selectedHours }} ชม.</span>
                  <button v-if="selected.length" type="button" :disabled="pending" class="link ml-2 min-h-8" @click="selected = []">ล้างการเลือก</button>
                </p>
                <button type="button" :disabled="!selected.length || pending" class="btn btn-primary min-h-10 px-5 text-xs" @click="approve(selected)">
                  {{ pending ? 'กำลังอนุมัติ...' : selected.length ? `อนุมัติแทน ${selected.length} รายการ` : 'อนุมัติแทน' }}
                </button>
              </div>
            </div>

            <ProxyQueueList
              v-if="queue.items.length"
              :items="queue.items"
              :selected-ids="selected.map(item => item.worklog.id)"
              :disabled="pending"
              @toggle="toggle"
              @toggle-all="toggleAll"
              @open="openReview"
            />
            <p v-else class="border-t border-line px-5 py-12 text-center text-sm text-ink-muted">ไม่มีงานรอตรวจของพี่เลี้ยงคนนี้</p>

            <div class="flex items-start gap-2.5 border-t border-line bg-page px-5 py-3 text-2xs text-slate-600">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
              <p class="tabular-nums">
                ส่งกลับแก้ไขได้เฉพาะพี่เลี้ยง งานที่ต้องแก้ให้รอพี่เลี้ยงกลับมาตรวจ
                <span v-if="queue.total" class="ml-1">แสดง {{ queue.items.length }} จาก {{ queue.total }} รายการ เรียงจากรอนานที่สุด</span>
                <button v-if="queue.items.length < queue.total" type="button" :disabled="status === 'pending'" class="link ml-2 min-h-8 disabled:text-slate-400" @click="limit += pageSize">
                  {{ status === 'pending' ? 'กำลังโหลด...' : 'แสดงเพิ่ม' }}
                </button>
              </p>
            </div>
          </section>
        </template>
      </AsyncState>
    </div>

    <ReviewWorklogModal
      v-model:open="isReviewOpen"
      proxy
      :item="viewing"
      :pending="pending ? 'approve' : undefined"
      :server-error="failure"
      @approve="comment => viewing && approve([viewing], comment)"
    />
  </div>
</template>
