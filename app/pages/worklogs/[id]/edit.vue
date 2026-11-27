<script setup lang="ts">
import { errorMessage } from '~/services/api'

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

// แก้ไขได้เฉพาะฉบับร่างหรือถูกส่งกลับ ที่ยังไม่เลยกำหนดแก้ไข (ขอบเขตงานข้อ 5.6, 8.4)
const blockedReason = computed(() => {
  const worklog = data.value?.worklog
  if (!worklog) return undefined
  if (worklog.reviewStatus !== 'draft' && worklog.reviewStatus !== 'returned') return 'รายการที่ส่งตรวจหรืออนุมัติแล้ว แก้ไขไม่ได้'
  if (worklog.canEdit === false) {
    const reason = worklog.reviewStatus === 'returned' ? 'เลยกำหนดแก้ไขหลังถูกส่งกลับแล้ว' : 'รายการนี้เกินช่วงย้อนหลังแล้ว'
    return `${reason} แก้ไขและส่งตรวจไม่ได้`
  }
  return undefined
})

// ตัดสินตอนเปิดหน้าครั้งเดียว หลังส่งตรวจฟอร์มยังแสดงผลการส่งอยู่
const initialBlock = ref<string | null>()
watch(data, (value) => {
  if (value && initialBlock.value === undefined) initialBlock.value = blockedReason.value ?? null
}, { immediate: true })

// ลบได้เฉพาะฉบับร่างหรือถูกส่งกลับ แม้เกินช่วงย้อนหลังแล้ว (ขอบเขตงานข้อ 8.4)
const canDelete = computed(() => ['draft', 'returned'].includes(data.value?.worklog.reviewStatus ?? ''))
const notify = useNotify()
const goBack = useGoBack()
const isDeleteOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string>()

function askDelete() {
  deleteError.value = undefined
  isDeleteOpen.value = true
}

async function deleteLog(reason: string) {
  const target = data.value?.worklog
  if (!target || isDeleting.value) return

  isDeleting.value = true
  deleteError.value = undefined
  try {
    await api.deleteWorklog(target.id, reason)
    isDeleteOpen.value = false
    notify('success', 'ลบรายการแล้ว', target.title)
    // ไม่ย้อนไปหน้าของรายการที่ถูกลบ เช่น หน้าประวัติ
    await goBack('/worklogs', path => path.startsWith(`/worklogs/${target.id}/`))
  }
  catch (failure) {
    deleteError.value = errorMessage(failure)
  }
  finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div>
    <header class="mb-4 border-b border-slate-200 pb-5">
      <BackButton fallback="/worklogs" class="mb-3" />
      <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-500" aria-label="breadcrumb">
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
          <div class="mt-4 flex items-center justify-center gap-4">
            <NuxtLink :to="`/worklogs/${worklogId}/history`" class="text-xs font-semibold text-indigo-600 underline underline-offset-2">ดูประวัติ</NuxtLink>
            <button v-if="canDelete" type="button" class="btn btn-danger-outline px-3 py-2 text-[11px]" @click="askDelete">
              ลบรายการ
            </button>
          </div>
        </div>

        <template v-else>
          <blockquote v-if="isReturned" class="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-slate-700">
            <span class="font-semibold text-rose-700">ความคิดเห็นของพี่เลี้ยง:</span>
            <span class="ml-1 whitespace-pre-line">{{ data.worklog.reviewComment ?? 'ไม่ได้ระบุ' }}</span>
            <span class="mt-1 block text-[11px] text-slate-500">แก้ไขและส่งตรวจใหม่ได้ถึง {{ formatThaiDate(editDeadline(data.worklog, data.context.backdateLimitDays)) }}</span>
          </blockquote>

          <BackdateWorklogForm :context="data.context" :worklog="data.worklog">
            <template #secondary-actions="{ disabled, submitted }">
              <button v-if="canDelete && !submitted" type="button" :disabled="disabled" class="btn btn-danger-outline mr-auto px-3 py-2.5 text-[11px]" @click="askDelete">
                ลบรายการ
              </button>
            </template>
          </BackdateWorklogForm>
        </template>
      </template>
    </AsyncState>

    <DeleteWorklogModal
      v-model:open="isDeleteOpen"
      :log="data?.worklog"
      :pending="isDeleting"
      :server-error="deleteError"
      @confirm="deleteLog"
    />
  </div>
</template>
