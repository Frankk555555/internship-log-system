<script setup lang="ts">
import type { WorkLog } from '~/types/worklog'

const props = defineProps<{
  log?: WorkLog
  /** กำลังส่งคำขอลบ */
  pending?: boolean
  /** ข้อความผิดพลาดจากเซิร์ฟเวอร์ */
  serverError?: string
}>()

const emit = defineEmits<{
  confirm: [reason: string]
}>()

const open = defineModel<boolean>('open', { required: true })

const reason = ref('')
const showError = ref(false)
const error = computed(() => showError.value && !reason.value.trim() ? 'กรุณาระบุเหตุผล' : undefined)

// เริ่มฟอร์มใหม่ทุกครั้งที่เปิด
watch(open, (isOpen) => {
  if (!isOpen) return
  reason.value = ''
  showError.value = false
})

// หน้าที่เรียกใช้เป็นผู้ปิดหน้าต่างเมื่อลบสำเร็จ
function confirm() {
  showError.value = true
  if (props.pending || !reason.value.trim()) return
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="ยืนยันการลบ"
    :dismissible="!pending"
    :close="!pending"
    :ui="{
      overlay: 'bg-slate-900/10',
      content: 'max-w-lg rounded-xl bg-white ring-slate-900 divide-slate-200',
      header: 'min-h-0 px-6 py-4',
      title: 'text-lg font-bold text-red-600',
      body: 'px-6 sm:px-6 py-5 sm:py-5',
      footer: 'justify-end gap-3 px-6 sm:px-6 py-4',
    }"
  >
    <template #description>
      <span class="sr-only">ระบุเหตุผลเพื่อยืนยันการลบรายการงาน</span>
    </template>

    <template #body>
      <p class="text-sm font-semibold text-slate-900">
        คุณต้องการลบ
        <span class="text-xs font-normal text-slate-400">{{ props.log?.title }} / {{ props.log ? formatThaiDate(props.log.date) : '' }}</span>
        ใช่หรือไม่
      </p>

      <label for="delete-reason" class="mt-4 block text-xs font-medium text-slate-700">เหตุผล *</label>
      <textarea
        id="delete-reason"
        v-model="reason"
        rows="3"
        required
        placeholder="ระบุเหตุผล..."
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? 'delete-reason-error' : undefined"
        class="mt-2 mb-1 block w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 aria-invalid:border-red-400"
      />
      <p v-if="error" id="delete-reason-error" class="text-[11px] font-medium text-red-500">{{ error }}</p>
      <p v-if="serverError" class="mt-1 text-[11px] font-medium text-red-500" role="alert">{{ serverError }}</p>
    </template>

    <template #footer>
      <button type="button" :disabled="pending" class="rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:text-slate-400" @click="open = false">
        ยกเลิก
      </button>
      <button type="button" :disabled="pending" class="rounded-lg bg-red-600 px-7 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 disabled:bg-red-300" @click="confirm">
        {{ pending ? 'กำลังลบ...' : 'ยืนยัน' }}
      </button>
    </template>
  </UModal>
</template>
