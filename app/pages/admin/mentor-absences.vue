<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { AbsenceInput, AbsenceType, MentorAbsence } from '~/types/admin'
import type { BadgeTone } from '~/types/worklog'

definePageMeta({ layout: 'staff', role: 'admin' })
useHead({ title: 'พี่เลี้ยงไม่อยู่' })

const api = useApi()
const notify = useNotify()

const type = ref<AbsenceType | 'all'>('all')
const { data, status, error, refresh } = await useLazyAsyncData('admin-absences', () => api.getMentorAbsences(type.value), { watch: [type] })

const typeOptions = computed(() => ([
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'absent', label: 'ไม่อยู่' },
  { value: 'unavailable', label: 'ไม่สะดวกตรวจ' },
] as const).map(option => ({ ...option, count: data.value?.counts[option.value] })))

const typeText: Record<AbsenceType, { label: string, source: string }> = {
  absent: { label: 'ไม่อยู่', source: 'แอดมินบันทึก' },
  unavailable: { label: 'ไม่สะดวกตรวจ', source: 'พี่เลี้ยงแจ้ง' },
}

function statusBadge(item: MentorAbsence): { label: string, tone: BadgeTone } {
  if (item.status === 'ended') return { label: 'สิ้นสุดแล้ว', tone: 'slate' }
  if (item.type === 'unavailable' && toThaiTimeParts(item.startAt).date === data.value?.today) return { label: 'วันนี้', tone: 'blue' }
  if (item.status === 'now') return { label: item.type === 'absent' ? 'ไม่อยู่ตอนนี้' : 'ตอนนี้', tone: 'amber' }
  return { label: 'กำหนดไว้', tone: 'blue' }
}

/** บรรทัดแรกคือเวลาเริ่ม บรรทัดสองคือเวลาสิ้นสุด วันเดียวกันไม่แสดงวันซ้ำ */
function range(item: MentorAbsence) {
  const start = toThaiTimeParts(item.startAt)
  const end = toThaiTimeParts(item.endAt)
  return {
    start: `${formatThaiDate(start.date)} ${start.time} น.`,
    end: `ถึง ${start.date === end.date ? '' : `${formatThaiDate(end.date)} `}${end.time} น.`,
  }
}

// บันทึกช่วงใหม่
const saving = ref(false)
const saveError = ref<string>()
const form = useTemplateRef<{ reset: () => void }>('form')

async function create(input: AbsenceInput) {
  if (saving.value) return
  saving.value = true
  saveError.value = undefined
  try {
    const saved = await api.createMentorAbsence(input)
    form.value?.reset()
    await refresh()
    const { start, end } = range(saved)
    notify('success', 'บันทึกช่วงที่พี่เลี้ยงไม่อยู่แล้ว', `${saved.mentorName}\n${start} ${end}`)
  }
  catch (problem) {
    saveError.value = errorMessage(problem)
    notify('error', 'บันทึกไม่สำเร็จ', saveError.value)
  }
  finally {
    saving.value = false
  }
}

// ปรับเวลาสิ้นสุด
const endOpen = ref(false)
const adjusting = ref<MentorAbsence>()
const adjustPending = ref(false)
const adjustError = ref<string>()

function openAdjust(item: MentorAbsence) {
  adjusting.value = item
  adjustError.value = undefined
  endOpen.value = true
}

async function adjust(endAt: string) {
  const target = adjusting.value
  if (!target || adjustPending.value) return
  adjustPending.value = true
  adjustError.value = undefined
  try {
    const saved = await api.updateAbsenceEnd(target.id, endAt)
    endOpen.value = false
    await refresh()
    notify('success', 'ปรับเวลาสิ้นสุดแล้ว', `${saved.mentorName}\n${range(saved).end}`)
  }
  catch (problem) {
    adjustError.value = errorMessage(problem)
    notify('error', 'ปรับเวลาไม่สำเร็จ', adjustError.value)
  }
  finally {
    adjustPending.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="พี่เลี้ยงไม่อยู่"
      description="ช่วงที่บันทึกไว้เปิดให้แอดมินอนุมัติงานแทนได้ ช่วงไม่สะดวกตรวจที่พี่เลี้ยงแจ้งเองแสดงไว้ให้ทราบเท่านั้น"
      :crumbs="[{ label: 'พื้นที่แอดมิน' }, { label: 'พี่เลี้ยงไม่อยู่' }]"
    />

    <div class="mt-4">
      <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
        <div v-if="data" class="grid items-start gap-4 xl:grid-cols-[22.5rem_minmax(0,1fr)]">
          <section class="card p-5" aria-labelledby="absence-form-title">
            <h2 id="absence-form-title" class="mb-4 text-base font-bold text-ink">บันทึกช่วงที่พี่เลี้ยงไม่อยู่</h2>
            <AbsenceForm ref="form" :mentors="data.mentors" :pending="saving" :server-error="saveError" @save="create" @edit="saveError = undefined" />
          </section>

          <section class="card overflow-hidden" aria-labelledby="absence-list-title">
            <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 id="absence-list-title" class="text-base font-bold text-ink">ช่วงที่บันทึกไว้</h2>
              <FilterChips v-model="type" label="กรองตามประเภท" :options="typeOptions" />
            </div>

            <!-- relative: ข้อความสำหรับโปรแกรมอ่านหน้าจอในตารางไม่ดันหน้าให้กว้างเกิน -->
            <div class="relative overflow-x-auto border-t border-line">
              <table class="w-full min-w-[40rem] table-fixed border-collapse text-left" :aria-busy="status === 'pending'">
                <thead>
                  <tr class="bg-page text-2xs font-semibold text-slate-600">
                    <th class="px-5 py-3">พี่เลี้ยงและเหตุผล</th>
                    <th class="w-[10.5rem] px-2 py-3">ช่วงเวลา</th>
                    <th class="w-[7rem] px-2 py-3">ประเภท</th>
                    <th class="w-[7rem] px-2 py-3">สถานะ</th>
                    <th class="w-[9rem] px-3 py-3"><span class="sr-only">การดำเนินการ</span></th>
                  </tr>
                </thead>
                <tbody class="text-xs text-slate-600">
                  <tr v-for="item in data.items" :key="item.id" class="border-t border-line align-middle">
                    <td class="px-5 py-3.5">
                      <p class="font-semibold text-ink">{{ item.mentorName }}</p>
                      <p class="mt-0.5 break-words text-2xs">{{ item.reason }}</p>
                    </td>
                    <td class="px-2 py-3.5">
                      <p class="font-semibold text-ink">{{ range(item).start }}</p>
                      <p class="mt-0.5 text-2xs">{{ range(item).end }}</p>
                    </td>
                    <td class="px-2 py-3.5">
                      <p class="font-semibold text-ink">{{ typeText[item.type].label }}</p>
                      <p class="mt-0.5 text-2xs">{{ typeText[item.type].source }}</p>
                    </td>
                    <td class="px-2 py-3.5"><StatusBadge v-bind="statusBadge(item)" /></td>
                    <td class="px-3 py-3.5 text-right">
                      <button
                        v-if="item.type === 'absent' && item.status !== 'ended'"
                        type="button"
                        class="btn btn-secondary px-3 py-1.5 text-2xs"
                        :aria-label="`ปรับเวลาสิ้นสุดของ ${item.mentorName} ${range(item).start}`"
                        @click="openAdjust(item)"
                      >
                        ปรับเวลาสิ้นสุด
                      </button>
                      <span v-else-if="item.type === 'absent'" class="text-2xs">{{ item.proxyApprovalCount ? `อนุมัติแทน ${item.proxyApprovalCount} รายการ` : 'ไม่มีการอนุมัติแทน' }}</span>
                      <span v-else>–</span>
                    </td>
                  </tr>
                  <tr v-if="!data.items.length" class="border-t border-line">
                    <td colspan="5" class="px-5 py-12 text-center text-sm text-ink-muted">ยังไม่มีช่วงที่บันทึกไว้</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </AsyncState>
    </div>

    <AbsenceEndModal v-model:open="endOpen" :absence="adjusting" :pending="adjustPending" :server-error="adjustError" @save="adjust" />
  </div>
</template>
