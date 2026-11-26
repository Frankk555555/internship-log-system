<script setup lang="ts">
import type { WorkLog } from '~/types/worklog'

defineProps<{
  log?: WorkLog
  pending?: boolean
}>()

const emit = defineEmits<{
  confirm: []
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    title="ยืนยันทำงานเสร็จสิ้น"
    :dismissible="!pending"
    :close="false"
    :ui="{
      overlay: 'bg-slate-900/10',
      content: 'max-w-md rounded-xl bg-white ring-slate-900 divide-slate-200',
      header: 'min-h-0 px-5 py-4',
      title: 'text-base font-bold text-slate-900',
      body: 'px-5 sm:px-5 py-4 sm:py-4',
      footer: 'justify-end gap-2.5 px-5 sm:px-5 py-4',
    }"
  >
    <template #description>
      <span class="sr-only">ยืนยันก่อนบันทึกเวลาสิ้นสุดของงาน</span>
    </template>

    <template #body>
      <p class="text-sm font-semibold text-slate-900">{{ log?.title }}</p>
      <p v-if="log" class="mt-1 text-xs text-slate-500">{{ formatThaiDate(log.date) }} · เริ่ม {{ log.startTime }} น.</p>
      <p class="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
        <UIcon name="i-lucide-triangle-alert" class="mt-px size-3.5 shrink-0" />
        ระบบจะบันทึกเวลาสิ้นสุดเป็นเวลาที่กดยืนยัน เมื่อบันทึกแล้วแก้ไขเวลาไม่ได้
      </p>
    </template>

    <template #footer>
      <button type="button" :disabled="pending" class="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-400" @click="open = false">
        ยกเลิก
      </button>
      <button type="button" :disabled="pending" class="rounded-lg bg-emerald-600 px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300" @click="emit('confirm')">
        {{ pending ? 'กำลังบันทึก...' : 'ยืนยันเสร็จสิ้น' }}
      </button>
    </template>
  </UModal>
</template>
