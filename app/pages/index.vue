<script setup lang="ts">
const { internship, summary, worklogs } = useWorklogs()
</script>

<template>
  <div>
    <AppHeader />

    <div class="dashboard-summary-grid grid gap-4">
      <InternshipProgressCard :internship="internship" />
      <SummaryStatCard
        title="ผ่านการอนุมัติแล้ว"
        :value="summary.approvedCount"
        meta="รายการ"
        tone="green"
      />
      <SummaryStatCard
        title="รอตรวจ / ส่งกลับแก้ไข"
        :value="summary.waitingReview"
        :secondary-value="summary.returned"
        meta="ส่งตรวจ / ส่งกลับแก้ไข"
        tone="orange"
      />
    </div>

    <WorklogTable :logs="worklogs" class="mt-5" />
  </div>
</template>
