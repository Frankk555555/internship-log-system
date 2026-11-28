<script setup lang="ts">
import type { Attachment } from '~/types/worklog'

const props = defineProps<{
  disabled?: boolean
  error?: string
}>()

const attachments = defineModel<Attachment[]>({ required: true })
const notify = useNotify()

const errorId = useId()
const rejected = ref<string[]>([])
const isDragging = ref(false)
// id ติดลบ = ไฟล์ที่ยังไม่ได้อัปโหลด
let nextId = -1
// ลิงก์ชั่วคราวที่สร้างในหน้านี้ ต้องคืนหน่วยความจำเมื่อเลิกใช้
const localUrls = new Set<string>()

function addFiles(files: FileList | null | undefined) {
  if (props.disabled || !files?.length) return

  const accepted: Attachment[] = []
  rejected.value = []

  for (const file of files) {
    if (!allowedExtensions.includes(extensionOf(file.name))) {
      rejected.value.push(`${file.name}: ไม่รองรับไฟล์ชนิดนี้`)
      continue
    }

    // ไฟล์เกินขนาดยังแสดงในรายการพร้อมข้อความเตือน ให้ผู้ใช้ลบแล้วเลือกใหม่
    const url = URL.createObjectURL(file)
    localUrls.add(url)
    accepted.push({
      id: nextId--,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url,
      file,
      error: fileError(file),
    })
  }

  attachments.value = [...attachments.value, ...accepted]

  const problems = [...rejected.value, ...accepted.flatMap(file => file.error ? [`${file.name}: ${file.error}`] : [])]
  const added = accepted.filter(file => !file.error)
  if (problems.length) notify('error', 'แนบไฟล์ไม่ได้', problems.join('\n'))
  if (added.length) notify('info', `เพิ่มไฟล์แล้ว ${added.length} ไฟล์`, 'กดบันทึกหรือส่งตรวจเพื่อเก็บไว้')
}

function uploadedLabel(value: string) {
  const { date, time } = toThaiTimeParts(value)
  return `${formatThaiDate(date)} • ${time} น.`
}

function onSelect(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(input.files)
  input.value = ''
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  addFiles(event.dataTransfer?.files)
}

function remove(target: Attachment) {
  if (target.url && localUrls.delete(target.url)) URL.revokeObjectURL(target.url)
  attachments.value = attachments.value.filter(file => file.id !== target.id)
  notify('info', 'นำไฟล์ออกแล้ว', target.name)
}

onBeforeUnmount(() => {
  for (const url of localUrls) URL.revokeObjectURL(url)
})
</script>

<template>
  <section class="card p-5  lg:p-7">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-base font-bold text-ink">ไฟล์แนบหลักฐาน *</h2>
      <span class="text-2xs text-ink-muted">ไฟล์ละไม่เกิน {{ maxFileSize / 1024 / 1024 }} MB</span>
    </div>

    <label
      class="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition focus-within:ring-2 focus-within:ring-brand"
      :class="[
        isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-200 bg-page',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-indigo-400',
      ]"
      @dragover.prevent="isDragging = !disabled"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <span class="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-brand">
        <UIcon name="i-lucide-upload" class="size-5" />
      </span>
      <span class="mt-3 text-xs font-semibold text-slate-700">ลากไฟล์วางที่นี่ หรือ คลิกเลือกไฟล์</span>
      <span class="mt-1 text-2xs text-slate-600">รองรับ PNG, JPG, JPEG, PDF, DOCX</span>
      <input
        type="file"
        multiple
        class="sr-only"
        :accept="allowedExtensions.map(extension => `.${extension}`).join(',')"
        :disabled="disabled"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? errorId : undefined"
        @change="onSelect"
      >
    </label>

    <ul v-if="rejected.length || error" class="mt-2 space-y-1 field-error" role="alert">
      <li v-if="error" :id="errorId">{{ error }}</li>
      <li v-for="reason in rejected" :key="reason" class="break-all">{{ reason }}</li>
    </ul>

    <ul class="mt-3 space-y-2">
      <li v-for="file in attachments" :key="file.id">
        <div class="flex items-center gap-3 rounded-xl border bg-page px-3 py-2.5" :class="file.error ? 'border-danger' : 'border-line'">
          <span class="rounded-md bg-indigo-100 px-2 py-1 text-2xs font-bold uppercase text-brand">{{ extensionOf(file.name) }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-semibold text-slate-700" :title="file.name">{{ file.name }}</p>
            <p class="text-2xs text-ink-muted">{{ formatFileSize(file.size) }} · แนบเมื่อ {{ uploadedLabel(file.uploadedAt) }}</p>
          </div>

          <a
            v-if="file.url"
            :href="file.url"
            :target="extensionOf(file.name) === 'docx' ? undefined : '_blank'"
            :download="extensionOf(file.name) === 'docx' ? file.name : undefined"
            class="text-2xs font-semibold text-brand hover:underline"
            :aria-label="`${extensionOf(file.name) === 'docx' ? 'ดาวน์โหลด' : 'ดูตัวอย่าง'} ${file.name}`"
          >
            {{ extensionOf(file.name) === 'docx' ? 'ดาวน์โหลด' : 'ดู' }}
          </a>
          <span v-else class="text-2xs text-ink-muted">ยังไม่มีตัวอย่าง</span>

          <button
            v-if="!disabled"
            type="button"
            class="text-2xs font-semibold text-danger underline underline-offset-2 hover:text-danger"
            :aria-label="`ลบ ${file.name}`"
            @click="remove(file)"
          >
            ลบ
          </button>
        </div>
        <p v-if="file.error" class="mt-1.5 field-error" role="alert">{{ file.error }}</p>
      </li>
    </ul>
  </section>
</template>
