<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { InternshipDetail, InternshipFilter, InternshipInput } from '~/types/admin'

definePageMeta({ layout: 'staff', role: 'admin' })
useHead({ title: 'การฝึกงานและพี่เลี้ยง' })

const api = useApi()
const notify = useNotify()

const filter = ref<InternshipFilter>('all')
const search = ref('')
const keyword = ref('')
const page = ref(1)

// รอพิมพ์เสร็จก่อนค้นหา ไม่ยิงคำขอทุกตัวอักษร
watch(search, (value, _previous, onCleanup) => {
  const timer = setTimeout(() => {
    keyword.value = value.trim()
  }, 300)
  onCleanup(() => clearTimeout(timer))
})

// เปลี่ยนตัวกรองแล้วเริ่มหน้าแรก ต้องประกาศก่อนโหลดข้อมูล
watch([filter, keyword], () => {
  page.value = 1
})

const { data, status, error, refresh } = await useLazyAsyncData(
  'admin-internships',
  () => api.getInternships({ filter: filter.value, q: keyword.value, page: page.value }),
  { watch: [filter, keyword, page] },
)

const filterOptions = computed(() => ([
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'no_mentor', label: 'ยังไม่มีพี่เลี้ยง' },
  { value: 'no_hours', label: 'ยังไม่มีเวลางาน' },
] as const).map(option => ({ ...option, count: data.value?.counts[option.value] })))

// นักศึกษาที่เลือกและแผงแก้ไข
const wide = useMediaQuery('(min-width: 80rem)')
const selectedId = ref<string>()
const detail = ref<InternshipDetail>()
const detailError = ref<string>()
const dirty = ref(false)
const saving = ref(false)
const saveError = ref<string>()

async function loadDetail() {
  const id = selectedId.value
  if (!id) return
  detailError.value = undefined
  try {
    const loaded = await api.getInternshipDetail(id)
    // ผู้ใช้อาจเลือกคนอื่นไปแล้วระหว่างรอ
    if (selectedId.value === id) detail.value = loaded
  }
  catch (problem) {
    if (selectedId.value === id) detailError.value = errorMessage(problem)
  }
}

function select(studentId: string) {
  if (studentId === selectedId.value || saving.value) return
  if (dirty.value) {
    notify('info', 'ยังมีการแก้ไขที่ไม่ได้บันทึก', 'กดบันทึกหรือยกเลิกก่อนเลือกนักศึกษาคนอื่น')
    return
  }
  selectedId.value = studentId
  detail.value = undefined
  saveError.value = undefined
  loadDetail()
}

function close() {
  const hadChange = dirty.value
  selectedId.value = undefined
  detail.value = undefined
  saveError.value = undefined
  dirty.value = false
  if (hadChange) notify('info', 'ยกเลิกแล้ว', 'ยังไม่ได้บันทึกอะไร')
}

async function save(input: InternshipInput) {
  const id = selectedId.value
  if (!id || saving.value) return
  saving.value = true
  saveError.value = undefined
  try {
    detail.value = await api.saveInternship(id, input)
    await refresh()
    notify('success', 'บันทึกข้อมูลฝึกงานแล้ว', detail.value.name)
  }
  catch (problem) {
    saveError.value = errorMessage(problem)
    notify('error', 'บันทึกข้อมูลฝึกงานไม่สำเร็จ', saveError.value)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="การฝึกงานและพี่เลี้ยง"
      description="หน่วยงาน ช่วงฝึกงาน เวลางาน และพี่เลี้ยงของนักศึกษาแต่ละคน"
      :crumbs="[{ label: 'พื้นที่แอดมิน' }, { label: 'การฝึกงาน' }]"
    />

    <div class="mt-4">
      <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
        <div v-if="data" class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23.75rem]">
          <section class="card overflow-hidden" aria-labelledby="internship-list-title">
            <h2 id="internship-list-title" class="sr-only">รายการฝึกงาน เลือกชื่อนักศึกษาเพื่อแก้ไข</h2>

            <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <FilterChips v-model="filter" label="กรองรายการฝึกงาน" :options="filterOptions" />
              <label class="relative block w-full sm:w-64">
                <span class="sr-only">ค้นหาชื่อ รหัสนักศึกษา หรือหน่วยงาน</span>
                <UIcon name="i-lucide-search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
                <input v-model="search" type="search" placeholder="ค้นหาชื่อหรือหน่วยงาน" class="field h-10 w-full bg-white pl-9 pr-3 text-xs text-slate-800">
              </label>
            </div>

            <!-- relative: ข้อความสำหรับโปรแกรมอ่านหน้าจอในตารางไม่ดันหน้าให้กว้างเกิน -->
            <div class="relative overflow-x-auto border-t border-line">
              <table class="w-full min-w-[40rem] table-fixed border-collapse text-left" :aria-busy="status === 'pending'">
                <thead>
                  <tr class="bg-page text-2xs font-semibold text-slate-600">
                    <th class="w-[8.5rem] px-5 py-3">นักศึกษา</th>
                    <th class="px-2 py-3">หน่วยงานและตำแหน่ง</th>
                    <th class="w-[7.5rem] px-2 py-3">ช่วงฝึกงาน</th>
                    <th class="w-[7rem] px-2 py-3">เวลางาน</th>
                    <th class="w-[8rem] px-3 py-3">พี่เลี้ยง</th>
                  </tr>
                </thead>
                <tbody class="text-xs text-slate-600">
                  <!-- กดได้ทั้งแถว แป้นพิมพ์กดที่ชื่อนักศึกษา -->
                  <tr
                    v-for="item in data.items"
                    :key="item.studentId"
                    class="cursor-pointer border-t border-line align-middle"
                    :class="item.studentId === selectedId ? 'bg-indigo-50 outline-2 -outline-offset-2 outline-brand' : 'hover:bg-page'"
                    @click="select(item.studentId)"
                  >
                    <td class="px-5 py-3.5">
                      <button type="button" class="min-h-6 cursor-pointer text-left font-semibold text-ink hover:text-brand" :aria-current="item.studentId === selectedId ? 'true' : undefined" :aria-label="`แก้ไขข้อมูลฝึกงานของ ${item.name}`">
                        {{ item.name }}
                      </button>
                      <p class="mt-0.5 break-all text-2xs tabular-nums">{{ item.studentId }}</p>
                    </td>
                    <td class="px-2 py-3.5">
                      <p class="font-semibold text-ink">{{ item.company ?? '–' }}</p>
                      <p class="mt-0.5 text-2xs">{{ item.position }}</p>
                    </td>
                    <td class="px-2 py-3.5">
                      <template v-if="item.startDate && item.endDate">
                        <span class="block whitespace-nowrap">{{ formatThaiDate(item.startDate) }}</span>
                        <span class="block whitespace-nowrap">ถึง {{ formatThaiDate(item.endDate) }}</span>
                      </template>
                      <template v-else>–</template>
                    </td>
                    <td class="px-2 py-3.5">
                      <span v-if="item.workStartTime" class="whitespace-nowrap">{{ item.workStartTime }}–{{ item.workEndTime }} น.</span>
                      <StatusBadge v-else label="ยังไม่กรอก" tone="amber" />
                    </td>
                    <td class="px-3 py-3.5">
                      <template v-if="item.mentorName">{{ item.mentorName }}</template>
                      <StatusBadge v-else label="ยังไม่กำหนด" tone="amber" />
                    </td>
                  </tr>
                  <tr v-if="!data.items.length" class="border-t border-line">
                    <td colspan="5" class="px-5 py-12 text-center text-sm text-ink-muted">ไม่พบนักศึกษาที่ตรงกับตัวกรอง</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <TablePagination v-model:page="page" :total="data.total" :page-size="data.pageSize" unit="คน" :disabled="status === 'pending'" />
          </section>

          <aside v-if="wide" class="card hidden p-5 xl:block" aria-label="ข้อมูลการฝึกงานที่เลือก">
            <template v-if="selectedId">
              <h2 class="text-base font-bold text-ink">แก้ไขข้อมูลการฝึกงาน</h2>
              <p v-if="detail" class="mb-4 mt-0.5 text-xs text-slate-600">{{ detail.name }} รหัส {{ detail.studentId }}</p>
              <AsyncState :loading="!detail && !detailError" :error="detailError ? { message: detailError } : undefined" @retry="loadDetail">
                <InternshipForm v-if="detail" v-model:dirty="dirty" :detail="detail" :pending="saving" :server-error="saveError" @save="save" @cancel="close" />
              </AsyncState>
            </template>
            <div v-else class="py-10 text-center">
              <UIcon name="i-lucide-mouse-pointer-click" class="size-6 text-ink-muted" />
              <p class="mt-3 text-sm font-semibold text-ink">ยังไม่ได้เลือกนักศึกษา</p>
              <p class="mt-1 text-xs text-slate-600">เลือกชื่อในตารางเพื่อดูและแก้ไขข้อมูลฝึกงาน</p>
            </div>
          </aside>
        </div>
      </AsyncState>
    </div>

    <!-- จอแคบกว่า 1280px ตารางไม่มีที่พอให้แผงด้านข้าง จึงเปิดเป็นหน้าต่าง -->
    <UModal
      v-if="!wide"
      :open="Boolean(selectedId)"
      title="แก้ไขข้อมูลการฝึกงาน"
      :dismissible="!dirty && !saving"
      :close="!saving"
      :ui="{
        overlay: 'bg-slate-900/10',
        content: 'max-w-xl rounded-xl bg-white ring-slate-900 divide-slate-200',
        header: 'min-h-0 px-6 py-4',
        title: 'text-lg font-bold text-ink',
        body: 'px-6 sm:px-6 py-5 sm:py-5',
      }"
      @update:open="value => { if (!value) close() }"
    >
      <template #description>
        <span class="text-xs text-slate-600">{{ detail ? `${detail.name} รหัส ${detail.studentId}` : 'กำลังโหลดข้อมูลนักศึกษา' }}</span>
      </template>
      <template #body>
        <AsyncState :loading="!detail && !detailError" :error="detailError ? { message: detailError } : undefined" @retry="loadDetail">
          <InternshipForm v-if="detail" v-model:dirty="dirty" :detail="detail" :pending="saving" :server-error="saveError" @save="save" @cancel="close" />
        </AsyncState>
      </template>
    </UModal>
  </div>
</template>
