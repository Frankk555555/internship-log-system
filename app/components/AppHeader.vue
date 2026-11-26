<script setup lang="ts">
defineProps<{
  unread?: number
}>()

const now = ref<Date | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  now.value = new Date()
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const formattedDateTime = computed(() => {
  if (!now.value) return ''

  const date = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now.value)

  const time = new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now.value)

  return `${date} • ${time} น.`
})
</script>

<template>
  <header class="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <div class="flex items-center gap-2 text-[11px] font-medium text-slate-400">
        <span>พื้นที่นักศึกษา</span>
        <span>/</span>
        <span class="text-slate-500">หน้าหลัก</span>
      </div>
      <h2 class="mt-2 text-2xl font-bold text-slate-900">หน้าหลัก</h2>
      <p class="mt-1 text-xs text-slate-500">แดชบอร์ดภาพรวม</p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-medium text-slate-500 shadow-sm">
        <span>เวลาปัจจุบัน: </span>
        <span v-if="formattedDateTime" class="text-slate-700">{{ formattedDateTime }}</span>
        <span v-else class="text-slate-400">กำลังโหลด...</span>
      </div>
      <NuxtLink to="/worklogs/new" class="flex items-center gap-2 rounded-lg bg-[linear-gradient(90deg,#7048f5_0%,#3f5beb_100%)] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110">
        <UIcon name="i-lucide-plus" class="size-4" />
        สร้างรายการงานใหม่
      </NuxtLink>
      <NotificationButton :count="unread" />
    </div>
  </header>
</template>
