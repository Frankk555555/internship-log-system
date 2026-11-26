<script setup lang="ts">
definePageMeta({ role: 'student' })

const route = useRoute()
const api = useApi()
const worklogId = Number(route.params.id)

const { data, status, error, refresh } = await useLazyAsyncData(`worklog-edit-${worklogId}`, async () => {
  const [worklog, context] = await Promise.all([api.getWorklog(worklogId), api.getWorklogFormContext('backdate')])
  return { worklog, context }
})

// รายการนอกสิทธิ์ แสดงหน้าแจ้งว่าเข้าถึงไม่ได้
watch(error, async (failure) => {
  if (failure?.statusCode === 403) await navigateTo('/forbidden', { replace: true })
}, { immediate: true })

const isReturned = computed(() => data.value?.worklog.reviewStatus === 'returned')
const heading = computed(() => isReturned.value ? 'แก้ไขและส่งตรวจใหม่' : 'แก้ไขฉบับร่าง')

// แก้ไขได้เฉพาะฉบับร่างหรือถูกส่งกลับ ที่ยังอยู่ในช่วงย้อนหลัง (ขอบเขตงานข้อ 5.6, 8.4)
const blockedReason = computed(() => {
  const worklog = data.value?.worklog
  if (!worklog) return undefined
  if (worklog.reviewStatus !== 'draft' && worklog.reviewStatus !== 'returned') return 'รายการที่ส่งตรวจหรืออนุมัติแล้ว แก้ไขไม่ได้'
  if (worklog.canEdit === false) return 'รายการนี้เกินช่วงย้อนหลังแล้ว แก้ไขและส่งตรวจไม่ได้'
  return undefined
})

// ตัดสินตอนเปิดหน้าครั้งเดียว หลังส่งตรวจฟอร์มยังแสดงผลการส่งอยู่
const initialBlock = ref<string | null>()
watch(data, (value) => {
  if (value && initialBlock.value === undefined) initialBlock.value = blockedReason.value ?? null
}, { immediate: true })
</script>

<template>
  <div>
    <header class="mb-4 border-b border-slate-200 pb-5">
      <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-400" aria-label="breadcrumb">
        <span>พื้นที่นักศึกษา</span>
        <span>/</span>
        <NuxtLink to="/worklogs" class="hover:text-slate-600">บันทึกงานประจำวัน</NuxtLink>
        <span>/</span>
        <span class="text-slate-500">แก้ไขรายการ</span>
      </nav>
      <h2 class="mt-2 text-2xl font-bold text-slate-900">{{ data ? heading : 'แก้ไขรายการ' }}</h2>
      <p class="mt-1 text-xs text-slate-500">{{ isReturned ? 'แก้ไขตามความคิดเห็นของพี่เลี้ยง แล้วส่งตรวจอีกครั้ง' : 'แก้ไขรายการ แล้วบันทึกฉบับร่างหรือส่งตรวจ' }}</p>
    </header>

    <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
      <template v-if="data">
        <div v-if="initialBlock" class="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center">
          <p class="text-sm font-medium text-slate-700">{{ initialBlock }}</p>
          <div class="mt-4 flex justify-center gap-4 text-xs font-semibold text-indigo-600 underline underline-offset-2">
            <NuxtLink to="/worklogs">กลับหน้าบันทึกงาน</NuxtLink>
            <NuxtLink :to="`/worklogs/${worklogId}/history`">ดูประวัติ</NuxtLink>
          </div>
        </div>

        <template v-else>
          <blockquote v-if="isReturned" class="mb-4 whitespace-pre-line rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-xs text-slate-700">
            <span class="font-semibold text-pink-700">ความคิดเห็นของพี่เลี้ยง:</span>
            {{ data.worklog.reviewComment ?? 'ไม่ได้ระบุ' }}
          </blockquote>

          <BackdateWorklogForm :context="data.context" :worklog="data.worklog" />

          <div class="mt-4 flex justify-end">
            <NuxtLink to="/worklogs" class="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
              กลับหน้าบันทึกงาน
            </NuxtLink>
          </div>
        </template>
      </template>
    </AsyncState>
  </div>
</template>
