<script setup lang="ts">
import type { ReviewItem } from '~/types/review'

const props = defineProps<{
  item?: ReviewItem
  /** กำลังส่งผลการตรวจ */
  pending?: 'approve' | 'return'
  serverError?: string
}>()

const emit = defineEmits<{
  approve: [comment: string]
  return: [comment: string, allowTimeEdit: boolean]
}>()

const open = defineModel<boolean>('open', { required: true })

const comment = ref('')
const needsComment = ref(false)
const allowTimeEdit = ref(false)
const commentError = computed(() => needsComment.value && !comment.value.trim() ? 'กรุณาระบุความคิดเห็นเมื่อส่งกลับแก้ไข' : undefined)

watch(open, (isOpen) => {
  if (!isOpen) return
  comment.value = ''
  needsComment.value = false
  allowTimeEdit.value = false
})

const worklog = computed(() => props.item?.worklog)
const canReview = computed(() => worklog.value?.reviewStatus === 'submitted')
const attachments = computed(() => worklog.value?.attachments ?? [])

const summary = computed(() => {
  const log = worklog.value
  if (!log?.startTime || !log.endTime) return ''
  return `${formatThaiDate(log.date)} • ${log.startTime}–${log.endTime} น. • ${formatHours(toMinutes(log.endTime) - toMinutes(log.startTime))} ชม.`
})

function approve() {
  if (!props.pending) emit('approve', comment.value.trim())
}

// ส่งกลับต้องมีความเห็นทุกครั้ง (ขอบเขตงานข้อ 10.5)
const notify = useNotify()
const commentBox = useTemplateRef<HTMLTextAreaElement>('commentBox')

function sendBack() {
  needsComment.value = true
  if (!comment.value.trim()) {
    notify('error', 'ยังส่งกลับไม่ได้', 'กรุณาระบุความคิดเห็นเมื่อส่งกลับแก้ไข')
    commentBox.value?.focus()
  }
  if (!props.pending && comment.value.trim()) emit('return', comment.value.trim(), allowTimeEdit.value)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="ตรวจรายการงาน"
    :dismissible="!pending"
    :close="false"
    :ui="{
      overlay: 'bg-slate-900/10',
      content: 'max-w-2xl rounded-xl bg-white ring-slate-900 divide-slate-200',
      header: 'min-h-0 px-5 py-4',
      title: 'text-base font-bold text-ink',
      body: 'px-5 sm:px-5 py-4 sm:py-4',
      footer: 'justify-end gap-2.5 px-5 sm:px-5 py-4',
    }"
  >
    <template #description>
      <span class="sr-only">ดูรายละเอียดงานและบันทึกผลการตรวจ</span>
    </template>

    <template #body>
      <div v-if="item && worklog">
        <dl class="flex flex-wrap items-start gap-x-8 gap-y-2">
          <div>
            <dt class="text-2xs font-semibold text-ink-muted">ผู้ส่ง</dt>
            <dd class="text-xs font-semibold text-ink">{{ item.studentName }} รหัสนักศึกษา {{ item.studentId }}</dd>
          </div>
          <div class="min-w-0">
            <dt class="text-2xs font-semibold text-ink-muted">หัวข้อ</dt>
            <dd class="text-xs font-semibold text-ink">{{ worklog.title }}</dd>
          </div>
          <div class="ml-auto flex flex-col items-end gap-1 text-2xs text-ink-muted">
            <span>{{ summary }}</span>
            <TimeFlagBadges :worklog="worklog" />
          </div>
        </dl>

        <h3 class="mt-3 text-2xs font-semibold text-ink-muted">รายละเอียดงาน</h3>
        <p class="mt-1.5 min-h-14 whitespace-pre-line rounded-lg bg-slate-100 px-3 py-2.5 text-xs text-slate-700">{{ worklog.description || '–' }}</p>

        <h3 class="mt-3 text-2xs font-semibold text-ink-muted">ไฟล์แนบ ({{ attachments.length }})</h3>
        <ul class="mt-1.5 space-y-1.5">
          <li v-for="file in attachments" :key="file.id" class="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
            <span class="min-w-0 flex-1 truncate text-2xs font-medium text-slate-700" :title="file.name">{{ file.name }}</span>
            <span class="text-2xs text-ink-muted">{{ formatFileSize(file.size) }}</span>
            <template v-if="file.url">
              <!-- DOCX เปิดดูในเบราว์เซอร์ไม่ได้ ให้ดาวน์โหลดอย่างเดียว (6.3) -->
              <a v-if="extensionOf(file.name) !== 'docx'" :href="file.url" target="_blank" rel="noopener" class="text-2xs link">ดูตัวอย่าง</a>
              <a :href="file.url" :download="file.name" class="text-2xs link">ดาวน์โหลด</a>
            </template>
            <span v-else class="text-2xs text-ink-muted">ไฟล์ตัวอย่าง ไม่มีเนื้อหาให้เปิด</span>
          </li>
          <li v-if="!attachments.length" class="text-2xs text-ink-muted">ไม่มีไฟล์แนบ</li>
        </ul>

        <NuxtLink :to="`/worklogs/${worklog.id}/history`" class="mt-3 inline-block text-2xs link">
          ดูประวัติการแก้ไข
        </NuxtLink>

        <template v-if="canReview">
          <label for="review-comment" class="mt-3 block text-2xs text-slate-600">ความคิดเห็น (จำเป็นเมื่อส่งกลับแก้ไข)</label>
          <textarea
            id="review-comment"
            ref="commentBox"
            v-model="comment"
            rows="3"
            placeholder="เพิ่มความคิดเห็นถึงนักศึกษา..."
            :readonly="Boolean(pending)"
            :aria-invalid="Boolean(commentError)"
            :aria-describedby="commentError ? 'review-comment-error' : undefined"
            class="field mt-1.5 block w-full resize-y px-3 py-2 text-xs placeholder:text-ink-muted"
          />
          <p v-if="commentError" id="review-comment-error" class="mt-1 field-error">{{ commentError }}</p>
          <label class="mt-2 flex items-start gap-2 text-2xs text-slate-600">
            <input id="review-allow-time" v-model="allowTimeEdit" type="checkbox" class="mt-px size-3.5 accent-brand" :disabled="Boolean(pending)">
            เปิดให้นักศึกษาแก้วันที่และเวลา (ใช้เมื่อส่งกลับเพราะเวลาไม่ถูกต้อง)
          </label>
        </template>

        <div v-else class="mt-3 flex flex-wrap items-center gap-2 text-2xs text-ink-muted">
          <span>สถานะ:</span>
          <StatusBadge v-bind="reviewStatusMeta[worklog.reviewStatus]" />
          <span v-if="worklog.reviewComment">ความคิดเห็น: {{ worklog.reviewComment }}</span>
        </div>

        <p v-if="serverError" class="mt-2 field-error" role="alert">{{ serverError }}</p>
      </div>
    </template>

    <template #footer>
      <button type="button" :disabled="Boolean(pending)" class="btn btn-secondary px-3.5 py-2 text-2xs" @click="open = false">
        {{ canReview ? 'ยกเลิก' : 'ปิด' }}
      </button>
      <template v-if="canReview">
        <button type="button" :disabled="Boolean(pending)" class="btn btn-sendback px-3.5 py-2 text-2xs" @click="sendBack">
          {{ pending === 'return' ? 'กำลังส่งกลับ...' : 'ส่งกลับแก้ไข' }}
        </button>
        <button type="button" :disabled="Boolean(pending)" class="btn btn-primary px-3.5 py-2 text-2xs" @click="approve">
          {{ pending === 'approve' ? 'กำลังอนุมัติ...' : 'อนุมัติ' }}
        </button>
      </template>
    </template>
  </UModal>
</template>
