<script setup lang="ts">
definePageMeta({ role: 'student' })

const api = useApi()
const user = useSessionUser()
const { data, status, error, refresh } = await useLazyAsyncData('dashboard', () => api.getDashboard())
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

        <WorklogTable :logs="data.recentWorklogs" class="mt-5" />
      </template>
    </AsyncState>
  </div>
</template>
