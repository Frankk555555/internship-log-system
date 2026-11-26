<script setup lang="ts">
// วันจันทร์ของสัปดาห์ที่เลือก รูปแบบ "YYYY-MM-DD"
const weekStart = defineModel<string>({ required: true })

const label = computed(() => formatWeekLabel(weekStart.value))
const picker = useTemplateRef<HTMLInputElement>('picker')

function moveWeek(weeks: number) {
  weekStart.value = addDays(weekStart.value, weeks * 7)
}

function openPicker() {
  if (!picker.value) return
  picker.value.value = weekStart.value
  picker.value.showPicker()
}

// เลือกวันใดก็ได้ จะเลื่อนไปสัปดาห์ (จันทร์–อาทิตย์) ของวันนั้น
function onPick(event: Event) {
  const { value } = event.target as HTMLInputElement
  if (value) weekStart.value = startOfWeek(value)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <span id="week-label" class="text-[11px] font-semibold text-slate-600">สัปดาห์ (จันทร์–อาทิตย์)</span>
    <div role="group" aria-labelledby="week-label" class="relative flex h-9 items-center rounded-lg border border-slate-200 bg-white">
      <button type="button" class="flex h-full items-center px-2 text-slate-500 hover:text-indigo-600" aria-label="สัปดาห์ก่อนหน้า" @click="moveWeek(-1)">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
      </button>
      <button type="button" class="flex h-full min-w-44 items-center justify-center gap-2 border-x border-slate-200 px-3 text-xs font-medium text-slate-800 hover:bg-slate-50" aria-label="เลือกสัปดาห์จากปฏิทิน" @click="openPicker">
        <UIcon name="i-lucide-calendar" class="size-4" />
        <span aria-live="polite">{{ label }}</span>
      </button>
      <button type="button" class="flex h-full items-center px-2 text-slate-500 hover:text-indigo-600" aria-label="สัปดาห์ถัดไป" @click="moveWeek(1)">
        <UIcon name="i-lucide-chevron-right" class="size-4" />
      </button>
      <input ref="picker" type="date" tabindex="-1" aria-hidden="true" class="pointer-events-none absolute bottom-0 left-1/2 size-px opacity-0" @change="onPick">
    </div>
  </div>
</template>
