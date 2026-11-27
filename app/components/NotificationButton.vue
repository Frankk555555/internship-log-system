<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { AppNotification, NotificationType } from '~/types/notification'

const api = useApi()
const notify = useNotify()
const user = useSessionUser()
const { data, error, refresh } =useLazyAsyncData('notifications', () => api.getNotifications())

const isOpen = ref(false)
const isMarking = ref(false)
const markError = ref<string>()

// เปิดแผงแล้วโหลดใหม่ ให้เห็นรายการล่าสุด
watch(isOpen, (open) => {
  if (!open) return
  markError.value = undefined
  refresh()
})

const items = computed(() => data.value ?? [])
const unread = computed(() => items.value.filter(item => !item.isRead).length)
const buttonLabel = computed(() => unread.value ? `การแจ้งเตือน ยังไม่อ่าน ${unread.value} รายการ` : 'การแจ้งเตือน')

const kinds: Record<NotificationType, { icon: string, tone: string }> = {
  new_submission: { icon: 'i-lucide-inbox', tone: 'bg-indigo-100 text-brand' },
  overdue_review: { icon: 'i-lucide-clock', tone: 'bg-amber-100 text-amber-700' },
  returned: { icon: 'i-lucide-rotate-ccw', tone: 'bg-rose-100 text-rose-700' },
  approved: { icon: 'i-lucide-check', tone: 'bg-emerald-100 text-emerald-700' },
}

function linkFor(item: AppNotification) {
  if (user.value?.role === 'supervisor') return { path: '/mentor/reviews', query: { student: item.studentId } }
  return item.canEdit ? `/worklogs/${item.worklogId}/edit` : `/worklogs/${item.worklogId}/history`
}

function timeLabel(value: string) {
  const { date, time } = toThaiTimeParts(value)
  return `${formatThaiDate(date)} • ${time} น.`
}

async function openItem(item: AppNotification) {
  isOpen.value = false
  if (item.isRead) return
  try {
    await api.markNotificationsRead([item.id])
    await refresh()
  }
  catch (problem) {
    notify('error', 'ทำเครื่องหมายอ่านแล้วไม่สำเร็จ', errorMessage(problem))
  }
}

async function markAll() {
  if (isMarking.value) return
  isMarking.value = true
  markError.value = undefined
  try {
    await api.markNotificationsRead()
    await refresh()
    notify('success', 'อ่านการแจ้งเตือนแล้ว', 'ทุกรายการเปลี่ยนเป็นอ่านแล้ว')
  }
  catch (problem) {
    markError.value = errorMessage(problem)
    notify('error', 'ทำเครื่องหมายอ่านแล้วไม่สำเร็จ', markError.value)
  }
  finally {
    isMarking.value = false
  }
}
</script>

<template>
  <UPopover
    v-model:open="isOpen"
    :content="{ align: 'end', sideOffset: 8, collisionPadding: 12 }"
    :ui="{ content: 'w-80 max-w-[calc(100vw-1.5rem)] rounded-xl bg-white ring-line' }"
  >
    <button type="button" class="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-slate-700 shadow-sm hover:bg-page" :aria-label="buttonLabel">
      <UIcon name="i-lucide-bell" class="size-4" />
      <span v-if="unread" class="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-danger px-1 text-2xs font-bold leading-none text-white" aria-hidden="true">{{ unread }}</span>
    </button>

    <template #content>
      <div class="text-ink">
        <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 class="text-sm font-bold">การแจ้งเตือน</h2>
          <button v-if="unread" type="button" :disabled="isMarking" class="link min-h-6 text-2xs disabled:text-slate-400" @click="markAll">
            {{ isMarking ? 'กำลังบันทึก...' : 'อ่านแล้วทั้งหมด' }}
          </button>
        </div>

        <p v-if="markError" class="notice-error mx-4 mt-3">{{ markError }}</p>

        <div v-if="error" class="px-4 py-6 text-center" role="alert">
          <p class="text-xs font-medium text-red-700">{{ error.message }}</p>
          <button type="button" class="btn btn-secondary mt-3 px-3 py-1.5 text-2xs" @click="refresh()">ลองอีกครั้ง</button>
        </div>
        <p v-else-if="!data" class="px-4 py-6 text-center text-xs text-ink-muted" role="status">กำลังโหลดการแจ้งเตือน...</p>
        <p v-else-if="!items.length" class="px-4 py-6 text-center text-xs text-ink-muted">ยังไม่มีการแจ้งเตือน</p>

        <ul v-else class="max-h-[min(24rem,60vh)] divide-y divide-slate-100 overflow-y-auto">
          <li v-for="item in items" :key="item.id">
            <NuxtLink :to="linkFor(item)" class="flex items-start gap-2.5 px-4 py-3 hover:bg-page" @click="openItem(item)">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full" :class="kinds[item.type].tone">
                <UIcon :name="kinds[item.type].icon" class="size-3.5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-xs" :class="item.isRead ? 'font-medium text-slate-600' : 'font-bold'">
                  {{ item.title }}<span v-if="!item.isRead" class="sr-only"> ยังไม่อ่าน</span>
                </span>
                <span class="mt-0.5 block whitespace-pre-line break-words text-2xs text-slate-600">{{ item.message }}</span>
                <span class="mt-1 block text-2xs text-ink-muted">{{ timeLabel(item.createdAt) }}</span>
              </span>
              <span v-if="!item.isRead" class="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>
