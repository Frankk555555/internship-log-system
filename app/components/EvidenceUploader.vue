<script setup lang="ts">
import type { Attachment } from '~/types/worklog'

const props = defineProps<{
  disabled?: boolean
  error?: string
}>()

const attachments = defineModel<Attachment[]>({ required: true })
const notify = useNotify()

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
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-7">
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-base font-bold text-slate-900">ไฟล์แนบหลักฐาน *</h3>
      <span class="text-[10px] text-slate-500 underline underline-offset-2">max 5MB</span>
    </div>

    <label
      class="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition focus-within:ring-2 focus-within:ring-indigo-400"
      :class="[
        isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-200 bg-slate-50',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-indigo-400',
      ]"
      @dragover.prevent="isDragging = !disabled"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <span class="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
        <UIcon name="i-lucide-upload" class="size-5" />
      </span>
      <span class="mt-3 text-xs font-semibold text-slate-700">ลากไฟล์วางที่นี่ หรือ คลิกเลือกไฟล์</span>
      <span class="mt-1 text-[11px] text-slate-500">รองรับ PNG, JPG, JPEG, PDF, DOCX</span>
      <input
        type="file"
        multiple
        class="sr-only"
        :accept="allowedExtensions.map(extension => `.${extension}`).join(',')"
        :disabled="disabled"
        @change="onSelect"
      >
    </label>

    <ul v-if="rejected.length || error" class="mt-2 space-y-1 text-[11px] font-medium text-red-600" role="alert">
      <li v-if="error">{{ error }}</li>
      <li v-for="reason in rejected" :key="reason" class="break-all">{{ reason }}</li>
    </ul>

    <ul class="mt-3 space-y-2">
      <li v-for="file in attachments" :key="file.id">
        <div class="flex items-center gap-3 rounded-xl border bg-slate-50 px-3 py-2.5" :class="file.error ? 'border-red-400' : 'border-slate-200'">
          <span class="rounded-md bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase text-indigo-600">{{ extensionOf(file.name) }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-semibold text-slate-700" :title="file.name">{{ file.name }}</p>
            <p class="text-[10px] text-slate-500">{{ formatFileSize(file.size) }} - uploaded_at: {{ toThaiTimeParts(file.uploadedAt).time }}</p>
          </div>

          <a
            v-if="file.url"
            :href="file.url"
            :target="extensionOf(file.name) === 'docx' ? undefined : '_blank'"
            :download="extensionOf(file.name) === 'docx' ? file.name : undefined"
            class="text-[11px] font-semibold text-indigo-600 hover:underline"
            :aria-label="`${extensionOf(file.name) === 'docx' ? 'ดาวน์โหลด' : 'ดูตัวอย่าง'} ${file.name}`"
          >
            {{ extensionOf(file.name) === 'docx' ? 'ดาวน์โหลด' : 'ดู' }}
          </a>
          <span v-else class="text-[11px] font-semibold text-slate-300" title="ไฟล์ตัวอย่าง ยังไม่มีเนื้อหาให้ดู">ดู</span>

          <button
            v-if="!disabled"
            type="button"
            class="text-[11px] font-semibold text-red-600 underline underline-offset-2 hover:text-red-600"
            :aria-label="`ลบ ${file.name}`"
            @click="remove(file)"
          >
            ลบ
          </button>
        </div>
        <p v-if="file.error" class="mt-1.5 text-[11px] font-medium text-red-600" role="alert">{{ file.error }}</p>
      </li>
    </ul>
  </section>
</template>
