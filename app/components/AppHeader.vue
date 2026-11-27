<script setup lang="ts">
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

  const { date, time } = toThaiTimeParts(now.value.toISOString())
  return `${formatThaiDate(date)} • ${time} น.`
})
</script>

<template>
  <PageHeader
    class="mb-5"
    plain
    stack-actions
    title="หน้าหลัก"
    description="แดชบอร์ดภาพรวม"
    :crumbs="[{ label: 'พื้นที่นักศึกษา' }, { label: 'หน้าหลัก' }]"
  >
    <template #actions>
      <div class="flex flex-wrap items-center gap-3">
        <div class="rounded-full border border-line bg-white px-4 py-2 text-2xs font-medium text-ink-muted shadow-sm">
          <span>เวลาปัจจุบัน: </span>
          <span v-if="formattedDateTime" class="text-slate-700">{{ formattedDateTime }}</span>
          <span v-else>กำลังโหลด...</span>
        </div>
        <NuxtLink to="/worklogs/new" class="btn btn-primary px-4 py-2.5 text-xs">
          <UIcon name="i-lucide-plus" class="size-4" />
          สร้างรายการงานใหม่
        </NuxtLink>
        <NotificationButton />
      </div>
    </template>
  </PageHeader>
</template>
