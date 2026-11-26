<script setup lang="ts">
definePageMeta({ role: 'student' })

const api = useApi()
const { data: context, status, error, refresh } = await useLazyAsyncData('worklog-form-backdate', () => api.getWorklogFormContext('backdate'))
</script>

<template>
  <div>
    <header class="mb-4 border-b border-slate-200 pb-5">
      <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-400" aria-label="breadcrumb">
        <span>พื้นที่นักศึกษา</span>
        <span>/</span>
        <NuxtLink to="/worklogs" class="hover:text-slate-600">บันทึกงานประจำวัน</NuxtLink>
        <span>/</span>
        <span class="text-slate-500">บันทึกงานย้อนหลัง</span>
      </nav>
      <h2 class="mt-2 text-2xl font-bold text-slate-900">บันทึกงานย้อนหลัง</h2>
      <p class="mt-1 text-xs text-slate-500">บันทึกรายการที่ทำเสร็จแล้วภายในช่วงฝึกงาน</p>
    </header>

    <AsyncState :loading="!context && status !== 'error'" :error="error" @retry="refresh()">
      <BackdateWorklogForm v-if="context" :context="context" />
    </AsyncState>
  </div>
</template>
