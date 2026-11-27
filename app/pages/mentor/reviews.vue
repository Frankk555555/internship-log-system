<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { ReviewFilter, ReviewItem } from '~/types/review'

definePageMeta({ layout: 'mentor', role: 'supervisor' })
useHead({ title: 'ตรวจงานนักศึกษา' })

const pageSize = 6
const api = useApi()
const user = useSessionUser()
const notify = useNotify()

// เปิดจากหน้านักศึกษาในความดูแล: กรองรายคน และเลือกแท็บเริ่มต้นได้
const route = useRoute()
const studentId = computed(() => route.query.student ? String(route.query.student) : undefined)
const filter = ref<ReviewFilter>(route.query.tab === 'all' ? 'all' : 'pending')
const limit = ref(pageSize)

const { data, status, error, refresh } = await useLazyAsyncData(
  'review-queue',
  async () => {
    const requested = filter.value
    const student = studentId.value
    return { filter: requested, student, queue: await api.getReviewQueue(requested, limit.value, student) }
  },
  { watch: [filter, limit, studentId] },
)

// แสดงเฉพาะข้อมูลของแท็บและนักศึกษาที่เลือกอยู่
const queue = computed(() => data.value?.filter === filter.value && data.value.student === studentId.value ? data.value.queue : undefined)
const tabs = computed(() => [
  { key: 'pending' as const, label: data.value ? `รอตรวจ (${data.value.queue.pendingCount})` : 'รอตรวจ' },
  { key: 'all' as const, label: 'ทั้งหมด' },
])

// เก็บรายการตามที่เห็นตอนเลือก (รวม version) ถ้าถูกแก้หลังจากนั้น การอนุมัติจะไม่ผ่าน (10.3)
const selected = ref<ReviewItem[]>([])
const isSelected = (id: number) => selected.value.some(item => item.worklog.id === id)

function toggle(item: ReviewItem) {
  selected.value = isSelected(item.worklog.id)
    ? selected.value.filter(other => other.worklog.id !== item.worklog.id)
    : [...selected.value, item]
}

function toggleAll(items: ReviewItem[], checked: boolean) {
  const ids = new Set(items.map(item => item.worklog.id))
  const others = selected.value.filter(item => !ids.has(item.worklog.id))
  selected.value = checked ? [...others, ...items] : others
}

// เปลี่ยนนักศึกษาแล้วต้องเลือกรายการใหม่
watch(studentId, () => {
  limit.value = pageSize
  selected.value = []
})

function selectTab(next: ReviewFilter) {
  if (filter.value === next) return
  filter.value = next
  limit.value = pageSize
  selected.value = []
}

// แท็บเลื่อนด้วยปุ่มลูกศรได้ตามรูปแบบแท็บมาตรฐาน
const tabList = useTemplateRef<HTMLElement>('tabList')

async function moveTab(step: number) {
  const keys = tabs.value.map(tab => tab.key)
  const next = keys[(keys.indexOf(filter.value) + step + keys.length) % keys.length]!
  selectTab(next)
  await nextTick()
  tabList.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
}

const viewing = ref<ReviewItem>()
const isReviewOpen = ref(false)
const isReturnOpen = ref(false)
const pending = ref<'approve' | 'return'>()
const failure = ref<string>()

function openReview(item: ReviewItem) {
  viewing.value = item
  failure.value = undefined
  isReviewOpen.value = true
}

function openBulkReturn() {
  failure.value = undefined
  isReturnOpen.value = true
}

function announce(kind: 'approve' | 'return', items: ReviewItem[]) {
  const first = items[0]!
  if (kind === 'approve') {
    const hours = formatHours(items.reduce((total, item) => total + reviewMinutes(item), 0))
    notify(
      'success',
      items.length === 1 ? 'อนุมัติรายการแล้ว' : `อนุมัติ ${items.length} รายการแล้ว`,
      `${items.length === 1 ? `${first.studentName} · ${first.worklog.title}\n` : ''}${hours} ชม. ถูกนับในรายงานรายสัปดาห์`,
    )
  }
  else {
    const names = [...new Set(items.map(item => item.studentName))].join(', ')
    notify(
      'returned',
      items.length === 1 ? 'ส่งกลับแก้ไขแล้ว' : `ส่งกลับแก้ไข ${items.length} รายการแล้ว`,
      `ส่งถึง ${names} พร้อมความคิดเห็นของคุณ\nนักศึกษาจะได้รับแจ้งให้แก้ไขและส่งตรวจใหม่`,
    )
  }
}

async function decide(kind: 'approve' | 'return', items: ReviewItem[], comment: string, allowTimeEdit = false) {
  if (pending.value || !items.length) return

  pending.value = kind
  failure.value = undefined
  try {
    const targets = items.map(({ worklog }) => ({ id: worklog.id, version: worklog.version ?? 0 }))
    const result = kind === 'approve'
      ? await api.approveWorklogs(targets, comment || undefined)
      : await api.returnWorklogs(targets, comment, allowTimeEdit)

    const succeeded = items.filter(item => result.succeededIds.includes(item.worklog.id))
    if (succeeded.length) announce(kind, succeeded)

    if (result.failures.length) {
      const lines = result.failures.map((problem) => {
        const title = items.find(item => item.worklog.id === problem.id)?.worklog.title
        return `${title}: ${problem.message}`
      })
      notify('error', `ทำรายการไม่สำเร็จ ${result.failures.length} รายการ`, lines.join('\n'))
    }

    // รายการที่ทำแล้วหรือข้อมูลเก่า ต้องเลือกใหม่จากข้อมูลล่าสุด
    selected.value = selected.value.filter(item => !targets.some(target => target.id === item.worklog.id))
    isReviewOpen.value = false
    isReturnOpen.value = false
    await refresh()
  }
  catch (problem) {
    failure.value = errorMessage(problem)
    notify('error', 'ทำรายการไม่สำเร็จ', failure.value)
  }
  finally {
    pending.value = undefined
  }
}
</script>

<template>
  <div>
    <header class="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <BackButton v-if="studentId" fallback="/mentor/students" class="mb-3" />
        <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-500" aria-label="breadcrumb">
          <span>พื้นที่พี่เลี้ยง</span>
          <span>/</span>
          <span class="text-slate-500">ตรวจงานนักศึกษา</span>
        </nav>
        <h2 class="mt-2 text-2xl font-bold text-slate-900">ตรวจบันทึกการปฏิบัติงาน</h2>
        <p class="mt-1 text-xs text-slate-500">ดูรายการงานที่นักศึกษาส่งตรวจ</p>
      </div>
      <NotificationButton :count="user?.unreadNotifications" />
    </header>

    <div ref="tabList" class="flex gap-2 border-b border-slate-200" role="tablist" aria-label="ตัวกรองรายการ" @keydown.left.prevent="moveTab(-1)" @keydown.right.prevent="moveTab(1)">
      <button
        v-for="tab in tabs"
        :id="`review-tab-${tab.key}`"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="filter === tab.key"
        aria-controls="review-panel"
        :tabindex="filter === tab.key ? 0 : -1"
        class="-mb-px min-w-24 border-b-2 py-3 pr-4 text-left text-[13px] tabular-nums transition-colors"
        :class="filter === tab.key ? 'border-indigo-600 font-semibold text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'"
        @click="selectTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <p v-if="studentId" class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      <span>แสดงเฉพาะ <strong class="font-semibold text-slate-900">{{ queue?.student ? `${queue.student.name} (${queue.student.studentId})` : studentId }}</strong></span>
      <NuxtLink to="/mentor/reviews" class="font-semibold text-indigo-600 underline underline-offset-2">ดูนักศึกษาทุกคน</NuxtLink>
    </p>

    <div id="review-panel" role="tabpanel" :aria-labelledby="`review-tab-${filter}`" class="mt-5">
      <div
        class="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-4 py-2 text-xs transition-colors"
        :class="selected.length ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'"
      >
        <p class="font-semibold tabular-nums" role="status">เลือกแล้ว {{ selected.length }} รายการ</p>
        <button v-if="selected.length" type="button" :disabled="Boolean(pending)" class="min-h-8 font-semibold underline underline-offset-2 hover:text-indigo-900" @click="selected = []">
          ล้างการเลือก
        </button>
      </div>

      <div class="mt-4">
        <AsyncState v-if="error" :loading="false" :error="error" @retry="refresh()" />

        <!-- โครงรายการระหว่างโหลด กันหน้าจอกระโดดตอนสลับแท็บ -->
        <div v-else-if="!queue" class="overflow-hidden rounded-lg border border-slate-200 bg-white" role="status">
          <span class="sr-only">กำลังโหลดข้อมูล...</span>
          <div v-for="row in pageSize" :key="row" class="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-0" aria-hidden="true">
            <span class="size-4 shrink-0 rounded bg-slate-200 motion-safe:animate-pulse" />
            <span class="h-3 w-24 rounded bg-slate-200 motion-safe:animate-pulse" />
            <span class="h-3 flex-1 rounded bg-slate-100 motion-safe:animate-pulse" />
            <span class="h-3 w-20 rounded bg-slate-200 motion-safe:animate-pulse" />
          </div>
        </div>

        <template v-else>
          <div v-if="!queue.items.length" class="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center">
            <p class="text-sm font-semibold text-slate-700">{{ filter === 'pending' ? 'ไม่มีรายการรอตรวจ' : 'ยังไม่มีรายการที่ส่งเข้ามา' }}</p>
            <template v-if="filter === 'pending'">
              <p class="mt-1 text-xs text-slate-500">รายการที่ตรวจแล้วดูได้ในแท็บ “ทั้งหมด”</p>
              <button type="button" class="btn btn-secondary mt-4 px-4 py-2 text-xs" @click="selectTab('all')">ดูรายการทั้งหมด</button>
            </template>
          </div>

          <ReviewQueueList
            v-else
            :items="queue.items"
            :selected-ids="selected.map(item => item.worklog.id)"
            :disabled="Boolean(pending)"
            @toggle="toggle"
            @toggle-all="toggleAll"
            @open="openReview"
          />

          <!-- จอแคบ: เมื่อเลือกรายการแล้ว ปุ่มจัดการเกาะอยู่ด้านล่างจอ -->
          <div
            v-if="queue.items.length"
            class="mt-4 flex flex-wrap items-center justify-between gap-3"
            :class="selected.length ? 'sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:px-0 lg:py-0' : ''"
          >
            <p class="text-[11px] tabular-nums text-slate-500" :class="selected.length ? 'hidden lg:block' : ''">
              แสดง {{ queue.items.length }} จาก {{ queue.total }} รายการ · ค้างตรวจเกิน {{ queue.overdueDays }} วันจะแจ้งเตือนอัตโนมัติ
              <button v-if="queue.items.length < queue.total" type="button" :disabled="status === 'pending'" class="ml-2 min-h-8 font-semibold text-indigo-600 underline underline-offset-2 disabled:text-slate-400" @click="limit += pageSize">
                {{ status === 'pending' ? 'กำลังโหลด...' : 'แสดงเพิ่ม' }}
              </button>
            </p>

            <div class="ml-auto flex w-full gap-3 sm:w-auto">
              <button type="button" :disabled="!selected.length || Boolean(pending)" class="btn btn-sendback min-h-10 flex-1 px-5 text-xs sm:flex-none" @click="openBulkReturn">
                ส่งกลับแก้ไข
              </button>
              <button type="button" :disabled="!selected.length || Boolean(pending)" class="btn btn-primary min-h-10 flex-1 px-7 text-xs sm:flex-none" @click="decide('approve', selected, '')">
                {{ pending === 'approve' ? 'กำลังอนุมัติ...' : 'อนุมัติที่เลือก' }}
              </button>
            </div>
          </div>

          <DeletedReturnList v-if="queue.deletedReturns.length" :items="queue.deletedReturns" class="mt-8" />
        </template>
      </div>
    </div>

    <ReviewWorklogModal
      v-model:open="isReviewOpen"
      :item="viewing"
      :pending="pending"
      :server-error="failure"
      @approve="comment => viewing && decide('approve', [viewing], comment)"
      @return="(comment, allowTimeEdit) => viewing && decide('return', [viewing], comment, allowTimeEdit)"
    />

    <ReturnReasonModal
      v-model:open="isReturnOpen"
      :count="selected.length"
      :pending="pending === 'return'"
      :server-error="failure"
      @confirm="(comment, allowTimeEdit) => decide('return', selected, comment, allowTimeEdit)"
    />
  </div>
</template>
