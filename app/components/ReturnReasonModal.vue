<script setup lang="ts">
// ส่งกลับหลายรายการพร้อมกัน ใช้ความเห็นเดียวกัน
defineProps<{
  count: number
  pending?: boolean
  serverError?: string
}>()

const emit = defineEmits<{
  confirm: [comment: string, allowTimeEdit: boolean]
}>()

const open = defineModel<boolean>('open', { required: true })

const comment = ref('')
const showError = ref(false)
const allowTimeEdit = ref(false)
const error = computed(() => showError.value && !comment.value.trim() ? 'กรุณาระบุความคิดเห็นเมื่อส่งกลับแก้ไข' : undefined)

watch(open, (isOpen) => {
  if (!isOpen) return
  comment.value = ''
  showError.value = false
  allowTimeEdit.value = false
})

const notify = useNotify()
const commentBox = useTemplateRef<HTMLTextAreaElement>('commentBox')

function confirm(pending?: boolean) {
  showError.value = true
  if (!comment.value.trim()) {
    notify('error', 'ยังส่งกลับไม่ได้', 'กรุณาระบุความคิดเห็น')
    commentBox.value?.focus()
  }
  if (!pending && comment.value.trim()) emit('confirm', comment.value.trim(), allowTimeEdit.value)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="ส่งกลับแก้ไข"
    :dismissible="!pending"
    :close="false"
    :ui="{
      overlay: 'bg-slate-900/10',
      content: 'max-w-lg rounded-xl bg-white ring-slate-900 divide-slate-200',
      header: 'min-h-0 px-5 py-4',
      title: 'text-base font-bold text-slate-900',
      body: 'px-5 sm:px-5 py-4 sm:py-4',
      footer: 'justify-end gap-2.5 px-5 sm:px-5 py-4',
    }"
  >
    <template #description>
      <span class="sr-only">ระบุความคิดเห็นเพื่อส่งรายการกลับให้นักศึกษาแก้ไข</span>
    </template>

    <template #body>
      <p class="text-xs text-slate-700">ส่งกลับ {{ count }} รายการให้นักศึกษาแก้ไข ความคิดเห็นนี้จะแนบกับทุกรายการ</p>
      <label for="return-comment" class="mt-3 block text-[11px] font-medium text-slate-700">ความคิดเห็น *</label>
      <textarea
        id="return-comment"
        ref="commentBox"
        v-model="comment"
        rows="3"
        required
        placeholder="เพิ่มความคิดเห็นถึงนักศึกษา..."
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? 'return-comment-error' : undefined"
        class="mt-1.5 block w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-500 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 aria-invalid:border-red-400"
      />
      <p v-if="error" id="return-comment-error" class="mt-1 text-[11px] font-medium text-red-600">{{ error }}</p>
      <label class="mt-2 flex items-start gap-2 text-[11px] text-slate-600">
        <input id="return-allow-time" v-model="allowTimeEdit" type="checkbox" class="mt-px size-3.5 accent-indigo-600" :disabled="pending">
        เปิดให้นักศึกษาแก้วันที่และเวลาของทุกรายการที่เลือก (ใช้เมื่อเวลาไม่ถูกต้อง)
      </label>
      <p v-if="serverError" class="mt-1 text-[11px] font-medium text-red-600" role="alert">{{ serverError }}</p>
    </template>

    <template #footer>
      <button type="button" :disabled="pending" class="btn btn-secondary px-3.5 py-2 text-[11px]" @click="open = false">
        ยกเลิก
      </button>
      <button type="button" :disabled="pending" class="btn btn-sendback px-3.5 py-2 text-[11px]" @click="confirm(pending)">
        {{ pending ? 'กำลังส่งกลับ...' : 'ส่งกลับแก้ไข' }}
      </button>
    </template>
  </UModal>
</template>
