<script setup lang="ts">
// วันจันทร์ของสัปดาห์ที่เลือก รูปแบบ "YYYY-MM-DD"
const weekStart = defineModel<string>({ required: true })

const label = computed(() => formatWeekLabel(weekStart.value))

function moveWeek(weeks: number) {
  weekStart.value = addDays(weekStart.value, weeks * 7)
}

</script>

<template>
  <div class="flex flex-col gap-1">
    <span id="week-label" class="text-2xs font-semibold text-slate-600">สัปดาห์ (จันทร์–อาทิตย์)</span>
    <div role="group" aria-labelledby="week-label" class="relative flex h-9 items-center rounded-lg border border-line bg-white">
      <button type="button" class="flex h-full items-center px-2 text-ink-muted hover:text-brand" aria-label="สัปดาห์ก่อนหน้า" @click="moveWeek(-1)">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
      </button>
      <!-- เลือกวันใดก็ได้ จะเลื่อนไปสัปดาห์ (จันทร์–อาทิตย์) ของวันนั้น -->
      <DatePicker week align="center" :value="weekStart" label="เลือกสัปดาห์" @pick="date => weekStart = startOfWeek(date)">
        <button type="button" class="flex h-full min-w-44 items-center justify-center gap-2 border-x border-line px-3 text-xs font-medium text-slate-800 hover:bg-page" aria-label="เลือกสัปดาห์จากปฏิทิน">
          <UIcon name="i-lucide-calendar" class="size-4" />
          <span aria-live="polite">{{ label }}</span>
        </button>
      </DatePicker>
      <button type="button" class="flex h-full items-center px-2 text-ink-muted hover:text-brand" aria-label="สัปดาห์ถัดไป" @click="moveWeek(1)">
        <UIcon name="i-lucide-chevron-right" class="size-4" />
      </button>
    </div>
  </div>
</template>
