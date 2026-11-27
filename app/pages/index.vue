<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { WorkLog } from '~/types/worklog'

definePageMeta({ role: 'student' })
useHead({ title: 'หน้าหลัก' })

const api = useApi()
const notify = useNotify()
const { data, status, error, refresh } = await useLazyAsyncData('dashboard', () => api.getDashboard())

const busyId = ref<number>()
// ข้อความผิดพลาดของการบันทึกเวลา ค้างไว้เหนือตารางจนกว่าจะปิดหรือทำรายการใหม่
const actionError = ref<string>()

const clock = useServerClock()

/** เลยเวลาเลิกงานแล้วจับเวลาไม่ได้ แจ้งเหตุผลแล้วพาไปกรอกเวลาที่ทำจริงในหน้าแก้ไข */
async function redirectAfterWork(action: 'start' | 'finish', log: WorkLog) {
  const now = clock.value?.time
  const hours = data.value?.internship
  if (!now || !hours || !isAfterWork(now, hours.workEndTime)) return false

  const reason = action === 'start' ? timerStartError(now, hours) : timerFinishError(now, hours)
  notify('error', 'บันทึกเวลาอัตโนมัติไม่ได้', reason!)
  await navigateTo(`/worklogs/${log.id}/edit`)
  return true
}

// เริ่มและจบงานแล้วเวลาถูกล็อก จึงถามยืนยันก่อน
const confirmAction = ref<'start' | 'finish'>('start')
const confirmTarget = ref<WorkLog>()
const isConfirmOpen = ref(false)

async function ask(action: 'start' | 'finish', log: WorkLog) {
  if (await redirectAfterWork(action, log)) return
  confirmAction.value = action
  confirmTarget.value = log
  isConfirmOpen.value = true
}

async function confirmRecord() {
  if (!confirmTarget.value) return
  await recordTime(confirmAction.value, confirmTarget.value)
  isConfirmOpen.value = false
}

// เซิร์ฟเวอร์เป็นผู้บันทึกเวลา หน้าจอแสดงผลที่ได้กลับมา
async function recordTime(action: 'start' | 'finish', log: WorkLog) {
  if (busyId.value !== undefined) return

  busyId.value = log.id
  actionError.value = undefined
  try {
    if (action === 'start') {
      const saved = await api.startWorklog(log.id)
      const moved = saved.date === log.date ? '' : `\nย้ายวันที่ของรายการเป็น ${formatThaiDate(saved.date)}`
      notify('success', 'เริ่มทำงานแล้ว', `${saved.title}\nเวลาเริ่ม ${saved.startTime} น.${moved}`)
    }
    else {
      const saved = await api.finishWorklog(log.id)
      notify('success', 'ทำงานเสร็จสิ้นแล้ว', `${saved.title}\n${saved.startTime}–${saved.endTime} น. แนบไฟล์แล้วส่งตรวจได้`)
    }
  }
  catch (problem) {
    actionError.value = `${log.title}: ${errorMessage(problem)}`
    notify('error', 'บันทึกเวลาไม่สำเร็จ', errorMessage(problem))
  }
  // โหลดใหม่แม้ไม่สำเร็จ ข้อมูลบนจออาจเก่ากว่าเซิร์ฟเวอร์
  await refresh()
  busyId.value = undefined
}
</script>

<template>
  <div>
    <AppHeader />

    <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
      <template v-if="data">
        <div class="dashboard-summary-grid grid gap-4">
          <InternshipProgressCard :internship="data.internship" />
          <SummaryStatCard
            title="ผ่านการอนุมัติแล้ว"
            :value="data.summary.approvedCount"
            meta="รายการ"
            tone="green"
          />
          <SummaryStatCard
            title="รอตรวจ / ส่งกลับแก้ไข"
            :value="data.summary.waitingReviewCount"
            :secondary-value="data.summary.returnedCount"
            meta="รอตรวจ / ส่งกลับแก้ไข"
            tone="orange"
          />
        </div>

        <ErrorNotice v-if="actionError" title="บันทึกเวลาไม่สำเร็จ" :messages="[actionError]" class="mt-5" @close="actionError = undefined" />

        <WorklogTable
          :logs="data.recentWorklogs"
          :today="data.today"
          :busy-id="busyId"
          class="mt-5"
          @start="log => ask('start', log)"
          @finish="log => ask('finish', log)"
        />
      </template>
    </AsyncState>

    <WorkTimeModal
      v-model:open="isConfirmOpen"
      :action="confirmAction"
      :log="confirmTarget"
      :today="data?.today"
      :pending="busyId !== undefined"
      @confirm="confirmRecord"
    />
  </div>
</template>
