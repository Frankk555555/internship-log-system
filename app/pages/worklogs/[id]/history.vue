<script setup lang="ts">
import { errorMessage } from '~/services/api'

// นักศึกษาและพี่เลี้ยงใช้หน้านี้ เลือกเมนูข้างตามบทบาท
definePageMeta({
  role: ['student', 'supervisor'],
  middleware: [() => {
    setPageLayout(useSessionUser().value?.role === 'supervisor' ? 'mentor' : 'default')
  }],
})

const route = useRoute()
const api = useApi()
const worklogId = Number(route.params.id)
const user = useSessionUser()
const isMentor = computed(() => user.value?.role === 'supervisor')

const { data, status, error, refresh } = await useLazyAsyncData(`worklog-history-${worklogId}`, () => api.getWorklogHistory(worklogId))

// รายการนอกสิทธิ์ แสดงหน้าแจ้งว่าเข้าถึงไม่ได้
watch(error, async (failure) => {
  if (failure?.statusCode === 403) await navigateTo('/forbidden', { replace: true })
}, { immediate: true })

const events = computed(() => (data.value?.events ?? []).map(event => ({ ...event, at: toThaiTimeParts(event.changedAt) })))

// ค่าเริ่มต้นเลือกการลบ ถ้าไม่มีเลือกการแก้ไขข้อมูลครั้งล่าสุด
const pickedId = ref<number>()
const selected = computed(() => events.value.find(event => event.id === pickedId.value)
  ?? events.value.find(event => event.type === 'delete')
  ?? events.value.find(event => event.type === 'edit')
  ?? events.value[0])

const reviewStatus = computed(() => data.value?.worklog.reviewStatus)
const isApproved = computed(() => reviewStatus.value === 'approved')
const deletion = computed(() => data.value?.worklog.deletion)

// รายการที่เลยกำหนดแก้ไขเปิดหน้าแก้ไขจากเมนูไม่ได้ จึงต้องลบจากหน้านี้ได้ (ขอบเขตงานข้อ 8.4)
const canDelete = computed(() => !isMentor.value && !deletion.value && ['draft', 'returned'].includes(reviewStatus.value ?? ''))
const notify = useNotify()
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
    // อยู่หน้าเดิม ให้เห็นผู้ลบ เวลา และเหตุผลที่บันทึกไว้
    pickedId.value = undefined
    await refresh()
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
      <BackButton :fallback="isMentor ? '/mentor/reviews' : '/worklogs'" class="mb-3" />
      <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-500" aria-label="breadcrumb">
        <span>พื้นที่{{ isMentor ? 'พี่เลี้ยง' : 'นักศึกษา' }}</span>
        <span>/</span>
        <NuxtLink :to="isMentor ? '/mentor/reviews' : '/worklogs'" class="hover:text-slate-600">{{ isMentor ? 'ตรวจงานนักศึกษา' : 'บันทึกงานประจำวัน' }}</NuxtLink>
        <span>/</span>
        <span class="text-slate-500">ดูประวัติ</span>
      </nav>
      <h2 class="mt-2 text-2xl font-bold text-slate-900">ประวัติงานและการแก้ไข</h2>
      <p class="mt-1 text-xs text-slate-500">ตรวจสอบผู้แก้ไข เวลา และข้อมูลก่อน–หลัง</p>
    </header>

    <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
      <div v-if="data && deletion" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
        <p class="font-semibold">รายการ “{{ data.worklog.title }}” ถูกลบแล้ว</p>
        <p class="mt-1">
          ลบโดย {{ deletion.deletedBy }} เมื่อ {{ formatThaiDate(toThaiTimeParts(deletion.deletedAt).date) }} • {{ toThaiTimeParts(deletion.deletedAt).time }} น.
        </p>
        <p class="mt-1 break-words">เหตุผล: {{ deletion.reason }}</p>
      </div>

      <div class="grid gap-4 lg:min-h-[38rem] lg:grid-cols-[minmax(0,1.36fr)_minmax(0,1fr)]">
        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 class="text-base font-bold text-slate-900">ประวัติรายการ</h3>

          <ol v-if="events.length" class="mt-3">
            <li v-for="(event, index) in events" :key="event.id" class="relative pb-2">
              <span v-if="index < events.length - 1" class="absolute -bottom-2 left-[7px] top-5 w-0.5 bg-slate-100" aria-hidden="true" />
              <span
                class="absolute left-0 top-2 size-4 rounded-full"
                :class="event.type === 'approval' ? 'bg-done' : event.type === 'delete' ? 'bg-danger' : 'bg-indigo-50'"
                aria-hidden="true"
              />
              <button
                type="button"
                class="ml-6 block w-[calc(100%-1.5rem)] rounded-lg px-2.5 py-1 text-left transition"
                :class="event.id === selected?.id ? 'bg-slate-50' : 'hover:bg-slate-50'"
                :aria-pressed="event.id === selected?.id"
                @click="pickedId = event.id"
              >
                <span class="block text-[11px] text-slate-500">{{ formatThaiDate(event.at.date) }} • {{ event.at.time }} น.</span>
                <span class="mt-0.5 block text-sm font-semibold text-slate-900">{{ event.title }}</span>
                <span class="mt-0.5 block text-[11px] text-slate-500">{{ event.actorName }}</span>
              </button>
            </li>
          </ol>
          <p v-else class="py-12 text-center text-sm text-slate-500">ยังไม่มีประวัติของรายการนี้</p>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite">
          <h3 class="text-base font-bold text-slate-900">รายละเอียดการแก้ไข</h3>

          <template v-if="selected && reviewStatus">
            <dl class="mt-4 space-y-4">
              <div>
                <dt class="text-[11px] text-slate-500">ผู้แก้ไข</dt>
                <dd class="mt-0.5 text-sm font-semibold text-slate-900">{{ selected.actorName }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-slate-500">วันที่และเวลา</dt>
                <dd class="mt-0.5 text-sm font-semibold text-slate-900">{{ formatThaiDate(selected.at.date) }} • {{ selected.at.time }} น.</dd>
              </div>
              <div>
                <dt class="text-[11px] text-slate-500">ก่อนแก้ไข</dt>
                <dd class="mt-0.5 break-words text-sm font-semibold text-slate-900">{{ selected.before }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-slate-500">หลังแก้ไข</dt>
                <dd class="mt-0.5 break-words text-sm font-semibold text-slate-900">{{ selected.after }}</dd>
              </div>
            </dl>

            <div class="mt-2 flex items-center gap-2">
              <span class="text-[11px] text-slate-500">สถานะ:</span>
              <StatusBadge v-if="deletion" label="ถูกลบ" tone="rose" />
              <StatusBadge v-else v-bind="reviewStatusMeta[reviewStatus]" />
            </div>
          </template>

          <p v-if="isApproved" class="mt-5 border-t border-slate-100 pt-5 text-xs text-slate-500">รายการที่อนุมัติแล้วเปิดดูได้อย่างเดียว</p>

          <div v-if="canDelete" class="mt-5 flex justify-end border-t border-slate-100 pt-5">
            <button type="button" class="btn btn-danger-outline px-3 py-2 text-[11px]" @click="askDelete">
              ลบรายการ
            </button>
          </div>
        </section>
      </div>
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
