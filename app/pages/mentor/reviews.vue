<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { ReviewFilter, ReviewItem } from '~/types/review'

definePageMeta({ layout: 'mentor', role: 'supervisor' })

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

function minutesOf({ worklog }: ReviewItem) {
  return worklog.startTime && worklog.endTime ? toMinutes(worklog.endTime) - toMinutes(worklog.startTime) : 0
}

function submittedLabel(item: ReviewItem) {
  const { date, time } = toThaiTimeParts(item.submittedAt)
  return `${formatThaiDayMonth(date)} ${time} น.`
}

function announce(kind: 'approve' | 'return', items: ReviewItem[]) {
  const first = items[0]!
  if (kind === 'approve') {
    const hours = formatHours(items.reduce((total, item) => total + minutesOf(item), 0))
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
    if (!isReviewOpen.value && !isReturnOpen.value) notify('error', 'ทำรายการไม่สำเร็จ', failure.value)
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
        <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-400" aria-label="breadcrumb">
          <span>พื้นที่พี่เลี้ยง</span>
          <span>/</span>
          <span class="text-slate-500">ตรวจงานนักศึกษา</span>
        </nav>
        <h2 class="mt-2 text-2xl font-bold text-slate-900">ตรวจบันทึกการปฏิบัติงาน</h2>
        <p class="mt-1 text-xs text-slate-500">ดูรายการงานที่นักศึกษาส่งตรวจ</p>
      </div>
      <NotificationButton :count="user?.unreadNotifications" />
    </header>

    <div class="flex gap-2 border-b border-slate-200" role="tablist" aria-label="ตัวกรองรายการ">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="filter === tab.key"
        class="-mb-px min-w-24 border-b-2 py-3 pr-4 text-left text-[13px] transition"
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

    <p class="mt-5 rounded-lg bg-indigo-50 px-4 py-3.5 text-xs font-semibold text-indigo-600" role="status">
      เลือกแล้ว {{ selected.length }} รายการ
    </p>

    <div class="mt-4">
      <AsyncState :loading="!queue && status !== 'error'" :error="error" @retry="refresh()">
        <template v-if="queue">
          <div class="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table class="w-full min-w-[860px] table-fixed border-collapse text-left">
              <thead>
                <tr class="bg-slate-100 text-[11px] font-semibold text-slate-500">
                  <th class="w-[5%] px-3.5 py-3"><span class="sr-only">เลือก</span></th>
                  <th class="w-[15%] px-2 py-3">นักศึกษา</th>
                  <th class="w-[9%] px-2 py-3">วันที่</th>
                  <th class="px-2 py-3">รายละเอียดงาน</th>
                  <th class="w-[12%] px-2 py-3">เวลา</th>
                  <th class="w-[9%] px-2 py-3">จำนวนชั่วโมง</th>
                  <th class="w-[11%] px-2 py-3">ส่งเมื่อ</th>
                  <th class="w-[10%] px-2 py-3">สถานะ</th>
                  <th class="w-[5%] px-2 py-3"><span class="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody class="text-xs text-slate-800">
                <tr v-for="item in queue.items" :key="item.worklog.id" class="border-t border-slate-200">
                  <td class="px-3.5 py-3.5">
                    <input
                      v-if="item.worklog.reviewStatus === 'submitted'"
                      type="checkbox"
                      class="size-4 align-middle accent-indigo-600"
                      :checked="isSelected(item.worklog.id)"
                      :disabled="Boolean(pending)"
                      :aria-label="`เลือก ${item.studentName} ${item.worklog.title}`"
                      @change="toggle(item)"
                    >
                  </td>
                  <td class="px-2 py-3.5">{{ item.studentName }}</td>
                  <td class="px-2 py-3.5">{{ formatThaiDateRange(item.worklog.date, item.worklog.date) }}</td>
                  <td class="px-2 py-3.5">{{ item.worklog.title }}</td>
                  <td class="px-2 py-3.5">
                    {{ item.worklog.startTime }}–{{ item.worklog.endTime }} น.
                    <TimeFlagBadges :worklog="item.worklog" class="mt-1" />
                  </td>
                  <td class="px-2 py-3.5">{{ formatHours(minutesOf(item)) }}</td>
                  <td class="px-2 py-3.5">{{ submittedLabel(item) }}</td>
                  <td class="px-2 py-3.5">
                    <StatusBadge v-if="item.isOverdue" :label="`ค้างตรวจ ${item.pendingDays} วัน`" tone="pink" />
                    <StatusBadge
                      v-else
                      v-bind="reviewStatusMeta[item.worklog.reviewStatus]"
                      :solid="item.worklog.reviewStatus !== 'returned'"
                    />
                  </td>
                  <td class="px-2 py-3.5">
                    <button type="button" class="text-[11px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800" :aria-label="`ตรวจ ${item.studentName} ${item.worklog.title}`" @click="openReview(item)">
                      {{ item.worklog.reviewStatus === 'submitted' ? 'ตรวจ' : 'ดู' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="!queue.items.length" class="border-t border-slate-200">
                  <td colspan="9" class="px-5 py-12 text-center text-sm text-slate-400">{{ filter === 'pending' ? 'ไม่มีรายการรอตรวจ' : 'ยังไม่มีรายการที่ส่งเข้ามา' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-5 flex flex-wrap items-start justify-between gap-3">
            <p class="order-2 text-[11px] text-slate-400 sm:order-1 sm:pt-9">
              แสดง {{ queue.items.length }} จาก {{ queue.total }} รายการ · ค้างตรวจเกิน {{ queue.overdueDays }} วันจะแจ้งเตือนอัตโนมัติ
              <button v-if="queue.items.length < queue.total" type="button" class="ml-2 font-semibold text-indigo-600 underline underline-offset-2" @click="limit += pageSize">
                แสดงเพิ่ม
              </button>
            </p>

            <div class="order-1 ml-auto flex gap-3 sm:order-2">
              <button type="button" :disabled="!selected.length || Boolean(pending)" class="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" @click="openBulkReturn">
                ส่งกลับแก้ไข
              </button>
              <button type="button" :disabled="!selected.length || Boolean(pending)" class="rounded-lg bg-indigo-600 px-7 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300" @click="decide('approve', selected, '')">
                {{ pending === 'approve' ? 'กำลังอนุมัติ...' : 'อนุมัติที่เลือก' }}
              </button>
            </div>
          </div>

          <DeletedReturnList v-if="queue.deletedReturns.length" :items="queue.deletedReturns" class="mt-6" />
        </template>
      </AsyncState>
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
