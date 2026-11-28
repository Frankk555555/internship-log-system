<script setup lang="ts">
definePageMeta({ role: 'student' })
useHead({ title: 'บันทึกงานย้อนหลัง' })

const api = useApi()
const { data: context, status, error, refresh } = await useLazyAsyncData('worklog-form-backdate', () => api.getWorklogFormContext('backdate'))
</script>

<template>
  <div>
    <PageHeader
      class="mb-4"
      title="บันทึกงานย้อนหลัง"
      :description="context ? `บันทึกรายการที่ต้องการบันทึกย้อนหลัง ย้อนได้สูงสุด ${context.backdateLimitDays} วัน` : undefined"
      :crumbs="[{ label: 'พื้นที่นักศึกษา' }, { label: 'บันทึกงานประจำวัน', to: '/worklogs' }, { label: 'บันทึกงานย้อนหลัง' }]"
    >
      <template #back>
        <BackButton fallback="/worklogs" />
      </template>
    </PageHeader>

    <AsyncState :loading="!context && status !== 'error'" :error="error" @retry="refresh()">
      <BackdateWorklogForm v-if="context" :context="context" />
    </AsyncState>
  </div>
</template>
