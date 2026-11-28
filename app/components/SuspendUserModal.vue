<script setup lang="ts">
import type { AdminUser } from '~/types/admin'

defineProps<{
  user?: AdminUser
  /** กำลังส่งคำขอ */
  pending?: boolean
  /** ข้อความผิดพลาดจากเซิร์ฟเวอร์ */
  serverError?: string
}>()

defineEmits<{
  confirm: []
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    title="ยืนยันการระงับบัญชี"
    :dismissible="!pending"
    :close="!pending"
    :ui="{
      overlay: 'bg-slate-900/10',
      content: 'max-w-lg rounded-xl bg-white ring-slate-900 divide-slate-200',
      header: 'min-h-0 px-6 py-4',
      title: 'text-lg font-bold text-danger',
      body: 'px-6 sm:px-6 py-5 sm:py-5',
      footer: 'justify-end gap-3 px-6 sm:px-6 py-4',
    }"
  >
    <template #description>
      <span class="sr-only">ยืนยันการระงับบัญชีผู้ใช้</span>
    </template>

    <template #body>
      <p class="text-sm font-semibold text-ink">
        คุณต้องการระงับบัญชี
        <span class="break-all text-xs font-normal text-ink-muted">{{ user?.name }} / {{ user?.email }}</span>
        ใช่หรือไม่
      </p>
      <p class="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-2xs font-medium text-amber-700">
        <UIcon name="i-lucide-triangle-alert" class="mt-px size-3.5 shrink-0" />
        ผู้ใช้จะถูกออกจากระบบทันที และเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง ข้อมูลและประวัติยังอยู่ครบ
      </p>
      <p v-if="serverError" class="mt-3 field-error" role="alert">{{ serverError }}</p>
    </template>

    <template #footer>
      <button type="button" :disabled="pending" class="btn btn-secondary px-6 py-2.5 text-xs" @click="open = false">
        ยกเลิก
      </button>
      <button type="button" :disabled="pending" class="btn btn-danger px-7 py-2.5 text-xs" @click="$emit('confirm')">
        {{ pending ? 'กำลังระงับ...' : 'ระงับบัญชี' }}
      </button>
    </template>
  </UModal>
</template>
