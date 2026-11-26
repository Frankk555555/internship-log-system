<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { WorkLog } from '~/types/worklog'

definePageMeta({ role: 'student' })

const api = useApi()
const { data, status, error, refresh } = await useLazyAsyncData('daily-worklogs', () => api.getDailyWorklogs())

const logs = computed(() => data.value?.worklogs ?? [])
const logToDelete = ref<WorkLog>()
const isDeleteOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string>()
const deletedTitle = ref<string>()

function askDelete(log: WorkLog) {
  logToDelete.value = log
  deleteError.value = undefined
  isDeleteOpen.value = true
}

async function deleteLog(reason: string) {
  const target = logToDelete.value
  if (!target || isDeleting.value) return

  isDeleting.value = true
  deleteError.value = undefined
  try {
    await api.deleteWorklog(target.id, reason)
    isDeleteOpen.value = false
    deletedTitle.value = target.title
    await refresh()
  }
  catch (failure) {
    deleteError.value = errorMessage(failure)
  }
  finally {
    isDeleting.value = false
  }
}

const workedHours = computed(() => {
  const minutes = logs.value.reduce((total, log) => {
    if (!log.startTime || !log.endTime) return total
    return total + toMinutes(log.endTime) - toMinutes(log.startTime)
  }, 0)

  return Number((minutes / 60).toFixed(2))
})

const approvedCount = computed(() => logs.value.filter(log => log.reviewStatus === 'approved').length)
const submittedCount = computed(() => logs.value.filter(log => log.reviewStatus === 'submitted').length)
const returnedCount = computed(() => logs.value.filter(log => log.reviewStatus === 'returned').length)

const unavailable = computed(() => {
  const range = data.value?.mentorUnavailable
  return range ? `${range.startTime}-${range.endTime}` : '–'
})
</script>

<template>
  <div>
    <header class="mb-3 border-b border-slate-200 pb-5">
      <div class="flex items-center gap-2 text-[11px] font-medium text-slate-400">
        <span>พื้นที่นักศึกษา</span>
        <span>/</span>
        <span class="text-slate-500">บันทึกงานประจำวัน</span>
      </div>
      <h2 class="mt-2 text-2xl font-bold text-slate-900">บันทึกการปฏิบัติงานประจำวัน</h2>
      <p class="mt-1 text-xs text-slate-500">{{ data?.semester }}</p>
    </header>

    <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
      <template v-if="data">
        <div class="dashboard-summary-grid grid gap-4 sm:grid-cols-2 [&>section]:min-h-24 [&>section]:p-3.5">
          <SummaryStatCard
            title="ชั่วโมงทำงานวันนี้"
            :value="`${workedHours} ชม.`"
            tone="slate"
          />
          <SummaryStatCard
            title="ผ่านการอนุมัติแล้ว"
            :value="approvedCount"
            meta="รายการ"
            tone="green"
          />
          <SummaryStatCard
            title="รอตรวจ / ส่งกลับแก้ไข"
            :value="submittedCount"
            :secondary-value="returnedCount"
            meta="ส่งตรวจ / ส่งกลับแก้ไข"
            tone="orange"
          />
          <SummaryStatCard
            title="พี่เลี้ยงไม่สะดวกตรวจงาน"
            :value="unavailable"
            meta="เวลา"
            tone="amber"
            compact
          />
        </div>

        <DailyWorklogTable :date="formatThaiDate(data.date)" :logs="logs" class="mt-3" @delete="askDelete" />
      </template>
    </AsyncState>

    <p v-if="deletedTitle" class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700" role="status">
      ลบรายการ “{{ deletedTitle }}” แล้ว
    </p>

    <DeleteWorklogModal
      v-model:open="isDeleteOpen"
      :log="logToDelete"
      :pending="isDeleting"
      :server-error="deleteError"
      @confirm="deleteLog"
    />

    <div class="mt-7 flex flex-wrap justify-end gap-3">
      <NuxtLink to="/worklogs/backdate" class="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
        บันทึกย้อนหลัง
      </NuxtLink>
      <NuxtLink to="/worklogs/new" class="flex items-center gap-2 rounded-lg bg-[linear-gradient(90deg,#7048f5_0%,#3f5beb_100%)] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110">
        <UIcon name="i-lucide-plus" class="size-4" />
        สร้างรายการงานใหม่
      </NuxtLink>
    </div>
  </div>
</template>
