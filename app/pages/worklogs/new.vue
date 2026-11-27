<script setup lang="ts">
definePageMeta({ role: 'student' })
useHead({ title: 'สร้างรายการงานใหม่' })

const api = useApi()
const { data: context, status, error, refresh } = await useLazyAsyncData('worklog-form-new', () => api.getWorklogFormContext('new'))
</script>

<template>
  <div>
    <PageHeader
      class="mb-4"
      title="รายละเอียดการปฏิบัติงาน"
      description="เพิ่มรายการงาน"
      :crumbs="[{ label: 'พื้นที่นักศึกษา' }, { label: 'บันทึกงานประจำวัน', to: '/worklogs' }, { label: 'สร้างรายการใหม่' }]"
    >
      <template #back>
        <BackButton fallback="/worklogs" />
      </template>
    </PageHeader>

    <AsyncState :loading="!context && status !== 'error'" :error="error" @retry="refresh()">
      <NewWorklogForm v-if="context" :context="context" />
    </AsyncState>
  </div>
</template>
