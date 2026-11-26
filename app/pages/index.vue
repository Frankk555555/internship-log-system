<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { WorkLog } from '~/types/worklog'

definePageMeta({ role: 'student' })

const api = useApi()
const user = useSessionUser()
const notify = useNotify()
const { data, status, error, refresh } = await useLazyAsyncData('dashboard', () => api.getDashboard())

const busyId = ref<number>()

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

async function start(log: WorkLog) {
  if (await redirectAfterWork('start', log)) return
  await recordTime('start', log)
}

// จบงานแล้วเวลาถูกล็อก จึงถามยืนยันก่อน
const finishTarget = ref<WorkLog>()
const isFinishOpen = ref(false)

async function askFinish(log: WorkLog) {
  if (await redirectAfterWork('finish', log)) return
  finishTarget.value = log
  isFinishOpen.value = true
}

async function confirmFinish() {
  if (!finishTarget.value) return
  await recordTime('finish', finishTarget.value)
  isFinishOpen.value = false
}

// เซิร์ฟเวอร์เป็นผู้บันทึกเวลา หน้าจอแสดงผลที่ได้กลับมา
async function recordTime(action: 'start' | 'finish', log: WorkLog) {
  if (busyId.value !== undefined) return

  busyId.value = log.id
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
    notify('error', 'บันทึกเวลาไม่สำเร็จ', errorMessage(problem))
  }
  // โหลดใหม่แม้ไม่สำเร็จ ข้อมูลบนจออาจเก่ากว่าเซิร์ฟเวอร์
  await refresh()
  busyId.value = undefined
}
</script>

<template>
  <div>
    <AppHeader :unread="user?.unreadNotifications" />

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
            meta="ส่งตรวจ / ส่งกลับแก้ไข"
            tone="orange"
          />
        </div>

        <WorklogTable
          :logs="data.recentWorklogs"
          :today="data.today"
          :busy-id="busyId"
          class="mt-5"
          @start="start"
          @finish="askFinish"
        />
      </template>
    </AsyncState>

    <FinishWorkModal v-model:open="isFinishOpen" :log="finishTarget" :pending="busyId !== undefined" @confirm="confirmFinish" />
  </div>
</template>
