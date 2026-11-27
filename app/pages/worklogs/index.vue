<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { WorkLog } from '~/types/worklog'

definePageMeta({ role: 'student' })
useHead({ title: 'บันทึกงานประจำวัน' })

const api = useApi()
const notify = useNotify()
const { data, status, error, refresh } = await useLazyAsyncData('daily-worklogs', () => api.getDailyWorklogs())

const logs = computed(() => data.value?.worklogs ?? [])
const logToDelete = ref<WorkLog>()
const isDeleteOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string>()

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
    notify('success', 'ลบรายการแล้ว', target.title)
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
  return range ? `${range.startTime}–${range.endTime}` : '–'
})
</script>

<template>
  <div>
    <PageHeader
      class="mb-3"
      title="บันทึกการปฏิบัติงานประจำวัน"
      :description="data?.semester"
      :crumbs="[{ label: 'พื้นที่นักศึกษา' }, { label: 'บันทึกงานประจำวัน' }]"
    />

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
            meta="รอตรวจ / ส่งกลับแก้ไข"
            tone="orange"
          />
          <SummaryStatCard
            title="พี่เลี้ยงไม่สะดวกตรวจงาน"
            :value="unavailable"
            meta="น."
            tone="amber"
            compact
          />
        </div>

        <DailyWorklogTable :date="formatThaiDate(data.date)" :logs="logs" class="mt-3" @delete="askDelete" />
      </template>
    </AsyncState>

    <DeleteWorklogModal
      v-model:open="isDeleteOpen"
      :log="logToDelete"
      :pending="isDeleting"
      :server-error="deleteError"
      @confirm="deleteLog"
    />

    <div class="mt-7 flex flex-wrap justify-end gap-3">
      <NuxtLink to="/worklogs/backdate" class="btn btn-secondary px-4 py-2.5 text-xs">
        บันทึกย้อนหลัง
      </NuxtLink>
      <NuxtLink to="/worklogs/new" class="btn btn-primary px-4 py-2.5 text-xs">
        <UIcon name="i-lucide-plus" class="size-4" />
        สร้างรายการงานใหม่
      </NuxtLink>
    </div>
  </div>
</template>
