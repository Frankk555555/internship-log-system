<script setup lang="ts">
// ปุ่มที่เปิดปฏิทิน พ.ศ. ใส่ปุ่มของหน้าที่เรียกใช้ในช่อง default
defineProps<{
  /** "YYYY-MM-DD" */
  value?: string
  label: string
  /** เลือกเป็นสัปดาห์ จันทร์–อาทิตย์ */
  week?: boolean
  align?: 'start' | 'center' | 'end'
}>()

const emit = defineEmits<{
  pick: [date: string]
}>()

const open = ref(false)
const calendar = useTemplateRef<{ focusDay: () => void }>('calendar')

// เปิดแล้วโฟกัสวันที่เลือกอยู่ แทนปุ่มเลื่อนเดือน
function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  calendar.value?.focusDay()
}

function pick(date: string) {
  emit('pick', date)
  open.value = false
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: align ?? 'end', sideOffset: 8, collisionPadding: 8, onOpenAutoFocus }"
    :ui="{ content: 'max-h-(--reka-popover-content-available-height) overflow-y-auto rounded-xl bg-white ring-line' }"
  >
    <!-- จอเตี้ย ปฏิทินสูงกว่าที่ว่าง เลื่อนดูภายในแผงได้ -->
    <slot />
    <template #content>
      <DateCalendar ref="calendar" :value="value" :label="label" :week="week" @pick="pick" />
    </template>
  </UPopover>
</template>
