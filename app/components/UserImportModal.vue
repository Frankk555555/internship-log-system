<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { ImportRow, UserImport } from '~/types/admin'

/** แถวที่พร้อมนำเข้าที่แสดงเป็นตัวอย่าง แถวที่ผิดแสดงครบทุกแถว */
const readyPreview = 3

const props = defineProps<{
  /** ระบุเพื่อดูผลการนำเข้าที่ผ่านมา ไม่ระบุ = นำเข้าใหม่ */
  importId?: string
}>()

const emit = defineEmits<{
  /** สร้างบัญชีแล้ว รายชื่อผู้ใช้ต้องโหลดใหม่ */
  imported: []
}>()

const open = defineModel<boolean>('open', { required: true })

const api = useApi()
const notify = useNotify()

const result = ref<UserImport>()
const busy = ref<'reading' | 'importing' | 'loading'>()
const failure = ref<string>()
const isDragging = ref(false)

const viewing = computed(() => Boolean(props.importId))
const imported = computed(() => result.value?.imported)

// เริ่มใหม่ทุกครั้งที่เปิด
watch(open, async (isOpen) => {
  if (!isOpen) return
  result.value = undefined
  failure.value = undefined
  busy.value = undefined
  isDragging.value = false
  if (!props.importId) return
  busy.value = 'loading'
  try {
    result.value = await api.getUserImport(props.importId)
  }
  catch (problem) {
    failure.value = errorMessage(problem)
  }
  finally {
    busy.value = undefined
  }
}, { immediate: true })

async function check(file: File | undefined) {
  if (!file || busy.value) return
  failure.value = undefined
  result.value = undefined
  const problem = importFileError(file)
  if (problem) {
    failure.value = `${file.name}: ${problem}`
    notify('error', 'ตรวจไฟล์ไม่ได้', failure.value)
    return
  }
  busy.value = 'reading'
  try {
    result.value = await api.previewUserImport(file)
  }
  catch (error) {
    failure.value = errorMessage(error)
    notify('error', 'ตรวจไฟล์ไม่ได้', failure.value)
  }
  finally {
    busy.value = undefined
  }
}

function onSelect(event: Event) {
  const input = event.target as HTMLInputElement
  check(input.files?.[0])
  // เลือกไฟล์เดิมซ้ำได้หลังแก้ไฟล์
  input.value = ''
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  check(event.dataTransfer?.files[0])
}

async function commit() {
  const target = result.value
  if (!target || busy.value) return
  busy.value = 'importing'
  failure.value = undefined
  try {
    const saved = await api.commitUserImport(target.importId)
    result.value = saved
    notify('success', `นำเข้า ${saved.readyCount} บัญชีแล้ว`, saved.errorCount ? `ข้าม ${saved.errorCount} แถวที่มีข้อผิดพลาด` : saved.fileName)
    emit('imported')
  }
  catch (problem) {
    failure.value = errorMessage(problem)
    notify('error', 'นำเข้าไม่สำเร็จ', failure.value)
  }
  finally {
    busy.value = undefined
  }
}

const downloading = ref(false)

async function downloadTemplate() {
  if (downloading.value) return
  downloading.value = true
  try {
    const url = URL.createObjectURL(await api.getUserImportTemplate())
    const link = document.createElement('a')
    link.href = url
    link.download = 'แบบฟอร์มนำเข้าผู้ใช้.xlsx'
    link.click()
    // รอให้เบราว์เซอร์เริ่มดาวน์โหลดก่อนคืนหน่วยความจำ
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  catch (problem) {
    notify('error', 'ดาวน์โหลดแบบฟอร์มไม่สำเร็จ', errorMessage(problem))
  }
  finally {
    downloading.value = false
  }
}

const shownRows = computed(() => {
  const rows = result.value?.rows ?? []
  return [...rows.filter(row => row.errors.length), ...rows.filter(row => !row.errors.length).slice(0, readyPreview)]
})

const note = computed(() => {
  const data = result.value
  if (!data || data.readyCount <= readyPreview) return data?.errorCount ? 'แสดงแถวที่มีข้อผิดพลาดก่อน' : undefined
  const ready = `${imported.value ? 'ที่นำเข้าแล้ว' : 'ที่พร้อมนำเข้า'}`
  const rest = `${readyPreview} จาก ${data.readyCount} แถว${ready}`
  return data.errorCount ? `แสดงแถวที่มีข้อผิดพลาดก่อน และอีก ${rest}` : `แสดง ${rest}`
})

const roleLabel = (row: ImportRow) => row.role ? roleLabels[row.role] : row.roleText || '–'
const okLabel = computed(() => imported.value ? 'นำเข้าแล้ว' : 'พร้อมนำเข้า')
const fileSize = computed(() => result.value ? formatFileSize(result.value.fileSize) : '')

const title = computed(() => viewing.value ? 'ผลการนำเข้าผู้ใช้' : 'นำเข้าผู้ใช้จาก Excel')
const description = computed(() => {
  if (!imported.value) return viewing.value ? 'ผลของการนำเข้าที่ผ่านมา' : 'ระบบตรวจทุกแถวก่อนนำเข้า แถวที่มีข้อผิดพลาดจะถูกข้าม แก้ในไฟล์แล้วนำเข้าใหม่ได้'
  const { date, time } = toThaiTimeParts(imported.value.at)
  return `นำเข้าเมื่อ ${formatThaiDate(date)} • ${time} น. โดย ${imported.value.by}`
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :dismissible="!busy"
    :close="false"
    :ui="{
      overlay: 'bg-slate-900/40',
      content: 'max-w-[45rem] rounded-xl bg-white ring-line divide-line',
      header: 'min-h-0 px-6 py-4',
      title: 'text-lg font-bold text-ink',
      body: 'px-6 sm:px-6 py-4 sm:py-4',
      footer: 'justify-end gap-3 px-6 sm:px-6 py-4 bg-page',
    }"
  >
    <template #description>
      <span class="text-xs text-slate-600">{{ description }}</span>
    </template>

    <template #body>
      <div class="space-y-4">
        <p v-if="busy === 'loading'" class="py-8 text-center text-sm text-ink-muted" role="status">กำลังโหลดผลการนำเข้า...</p>

        <template v-if="!viewing">
          <div v-if="result" class="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3">
            <UIcon name="i-lucide-file-spreadsheet" class="size-6 shrink-0 text-emerald-700" />
            <div class="min-w-0 flex-1 basis-40">
              <p class="break-all text-sm font-semibold text-ink">{{ result.fileName }}</p>
              <p class="mt-0.5 text-2xs tabular-nums text-slate-600">{{ result.rows.length }} แถว ขนาด {{ fileSize }}</p>
            </div>
            <label v-if="!imported" class="btn btn-secondary ml-auto min-h-10 cursor-pointer px-4 text-xs focus-within:ring-2 focus-within:ring-brand">
              เลือกไฟล์อื่น
              <input type="file" accept=".xlsx" class="sr-only" :disabled="Boolean(busy)" @change="onSelect">
            </label>
          </div>

          <label
            v-else
            class="flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition focus-within:ring-2 focus-within:ring-brand"
            :class="[
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-200 bg-page',
              busy ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-indigo-400',
            ]"
            @dragover.prevent="isDragging = !busy"
            @dragleave="isDragging = false"
            @drop.prevent="onDrop"
          >
            <UIcon name="i-lucide-upload" class="size-5 text-brand" />
            <span class="mt-2 text-xs font-semibold text-slate-700" role="status">
              {{ busy === 'reading' ? 'กำลังตรวจไฟล์...' : 'ลากไฟล์วางที่นี่ หรือ คลิกเลือกไฟล์' }}
            </span>
            <span class="mt-1 text-2xs text-slate-600">ไฟล์ .xlsx ไม่เกิน {{ maxImportMegabytes }} MB และ {{ maxImportRows }} แถว</span>
            <input type="file" accept=".xlsx" class="sr-only" :disabled="Boolean(busy)" @change="onSelect">
          </label>

          <p v-if="!imported" class="text-xs text-slate-600">
            ยังไม่มีไฟล์?
            <button type="button" class="link ml-1 min-h-8" :disabled="downloading" @click="downloadTemplate">ดาวน์โหลดแบบฟอร์ม</button>
            <span class="block text-2xs">บทบาทกรอก {{ roleLabels.student }} {{ roleLabels.supervisor }} หรือ{{ roleLabels.admin }}</span>
          </p>
        </template>

        <p v-if="failure" class="notice-error break-words" role="alert">{{ failure }}</p>

        <section v-if="result" aria-labelledby="import-result-title">
          <div class="flex flex-wrap items-center gap-2" role="status">
            <h3 id="import-result-title" class="text-sm font-bold text-ink">{{ imported ? 'ผลการนำเข้า' : 'ผลตรวจ' }}</h3>
            <StatusBadge :label="`${okLabel} ${result.readyCount} แถว`" :tone="result.readyCount ? 'green' : 'slate'" />
            <StatusBadge v-if="result.errorCount" :label="`${imported ? 'ข้าม' : 'มีข้อผิดพลาด'} ${result.errorCount} แถว`" tone="rose" />
          </div>

          <div class="relative mt-3 overflow-hidden rounded-lg border border-line">
            <table class="w-full table-fixed border-collapse text-left">
              <thead>
                <tr class="bg-page text-2xs font-semibold text-slate-600">
                  <th class="w-12 px-3 py-2">แถว</th>
                  <th class="px-2 py-2">ชื่อและอีเมล</th>
                  <th class="hidden w-20 px-2 py-2 sm:table-cell">บทบาท</th>
                  <th class="hidden w-[14rem] px-2 py-2 sm:table-cell">ผลตรวจ</th>
                </tr>
              </thead>
              <tbody class="text-xs text-slate-600">
                <tr v-for="row in shownRows" :key="row.row" class="border-t border-line align-middle">
                  <td class="px-3 py-3 tabular-nums">{{ row.row }}</td>
                  <td class="px-2 py-3">
                    <p class="break-words font-semibold text-ink">{{ row.name || '–' }}</p>
                    <p class="mt-0.5 break-all text-2xs">{{ row.email || '–' }}</p>
                    <!-- จอแคบ: บทบาทและผลตรวจอยู่ใต้ชื่อ -->
                    <div class="mt-1.5 flex flex-wrap items-center gap-1 sm:hidden">
                      <span class="mr-1 text-2xs">{{ roleLabel(row) }}</span>
                      <StatusBadge v-for="error in row.errors" :key="error" :label="error" tone="rose" />
                      <StatusBadge v-if="!row.errors.length" :label="okLabel" tone="green" />
                    </div>
                  </td>
                  <td class="hidden break-words px-2 py-3 sm:table-cell">{{ roleLabel(row) }}</td>
                  <td class="hidden px-2 py-3 sm:table-cell">
                    <div class="flex flex-col items-start gap-1">
                      <StatusBadge v-for="error in row.errors" :key="error" :label="error" tone="rose" />
                      <StatusBadge v-if="!row.errors.length" :label="okLabel" tone="green" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="note" class="mt-2 text-2xs text-slate-600">{{ note }}</p>
          <p v-if="imported && result.readyCount" class="mt-2 rounded-lg bg-page px-3 py-2 text-xs text-slate-600">
            นักศึกษาเข้าครั้งแรกด้วยรหัสนักศึกษา บทบาทอื่นได้รับลิงก์ตั้งรหัสผ่านทางอีเมล
          </p>
        </section>
      </div>
    </template>

    <template #footer>
      <button type="button" :disabled="Boolean(busy)" class="btn btn-secondary px-5 py-2.5 text-xs" @click="open = false">
        {{ viewing || imported ? 'ปิด' : 'ยกเลิก' }}
      </button>
      <button
        v-if="!viewing && !imported"
        type="button"
        :disabled="!result?.readyCount || Boolean(busy)"
        class="btn btn-primary px-5 py-2.5 text-xs"
        @click="commit"
      >
        {{ busy === 'importing' ? 'กำลังนำเข้า...' : result?.readyCount ? `นำเข้า ${result.readyCount} รายการ` : 'นำเข้า' }}
      </button>
    </template>
  </UModal>
</template>
