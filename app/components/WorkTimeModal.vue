<script setup lang="ts">
import type { WorkLog } from '~/types/worklog'

const props = defineProps<{
  /** เริ่มงานหรือจบงาน ทั้งสองอย่างบันทึกเวลาแล้วแก้ไม่ได้ จึงถามยืนยันก่อน */
  action: 'start' | 'finish'
  log?: WorkLog
  /** วันที่ปัจจุบันของเซิร์ฟเวอร์ */
  today?: string
  pending?: boolean
}>()

const emit = defineEmits<{
  confirm: []
}>()

const open = defineModel<boolean>('open', { required: true })

const text = computed(() => props.action === 'start'
  ? {
      title: 'ยืนยันเริ่มทำงาน',
      description: 'ยืนยันก่อนบันทึกเวลาเริ่มของงาน',
      warning: 'ระบบจะบันทึกเวลาเริ่มเป็นเวลาที่กดยืนยัน เมื่อบันทึกแล้วแก้ไขเวลาไม่ได้',
      confirm: 'ยืนยันเริ่มทำงาน',
      button: 'btn-start',
    }
  : {
      title: 'ยืนยันทำงานเสร็จสิ้น',
      description: 'ยืนยันก่อนบันทึกเวลาสิ้นสุดของงาน',
      warning: 'ระบบจะบันทึกเวลาสิ้นสุดเป็นเวลาที่กดยืนยัน เมื่อบันทึกแล้วแก้ไขเวลาไม่ได้',
      confirm: 'ยืนยันเสร็จสิ้น',
      button: 'btn-done',
    })

// รายการของวันก่อน เมื่อเริ่มงานจะนับเป็นงานของวันนี้
const movesDate = computed(() => props.action === 'start' && Boolean(props.today) && props.log?.date !== props.today)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="text.title"
    :dismissible="!pending"
    :close="false"
    :ui="{
      overlay: 'bg-slate-900/10',
      content: 'max-w-md rounded-xl bg-white ring-slate-900 divide-slate-200',
      header: 'min-h-0 px-5 py-4',
      title: 'text-base font-bold text-ink',
      body: 'px-5 sm:px-5 py-4 sm:py-4',
      footer: 'justify-end gap-2.5 px-5 sm:px-5 py-4',
    }"
  >
    <template #description>
      <span class="sr-only">{{ text.description }}</span>
    </template>

    <template #body>
      <p class="text-sm font-semibold text-ink">{{ log?.title }}</p>
      <p v-if="log" class="mt-1 text-xs text-ink-muted">
        {{ formatThaiDate(log.date) }}<template v-if="action === 'finish'"> · เริ่ม {{ log.startTime }} น.</template>
      </p>
      <p class="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-2xs font-medium text-amber-700">
        <UIcon name="i-lucide-triangle-alert" class="mt-px size-3.5 shrink-0" />
        <span>
          {{ text.warning }}
          <span v-if="movesDate" class="mt-1 block">วันที่ของรายการจะเปลี่ยนเป็น {{ formatThaiDate(today!) }}</span>
        </span>
      </p>
    </template>

    <template #footer>
      <button type="button" :disabled="pending" class="btn btn-secondary px-3.5 py-2 text-2xs" @click="open = false">
        ยกเลิก
      </button>
      <button type="button" :disabled="pending" class="btn px-3.5 py-2 text-2xs" :class="text.button" @click="emit('confirm')">
        {{ pending ? 'กำลังบันทึก...' : text.confirm }}
      </button>
    </template>
  </UModal>
</template>
