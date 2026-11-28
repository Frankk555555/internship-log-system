<script setup lang="ts">
import type { ReviewItem } from '~/types/review'

const props = defineProps<{
  items: ReviewItem[]
  /** id ของรายการที่เลือกไว้ */
  selectedIds: number[]
  /** ระหว่างส่งผลการตรวจ ปิดการเลือกและการเปิดรายการ */
  disabled?: boolean
}>()

const emit = defineEmits<{
  toggle: [item: ReviewItem]
  /** เลือกหรือยกเลิกทุกรายการรอตรวจที่แสดงอยู่ */
  toggleAll: [items: ReviewItem[], checked: boolean]
  open: [item: ReviewItem]
}>()

const selected = computed(() => new Set(props.selectedIds))
// เลือกได้เฉพาะรายการที่ยังรอตรวจ
const selectable = computed(() => props.items.filter(item => item.worklog.reviewStatus === 'submitted'))
const selectedShown = computed(() => selectable.value.filter(item => selected.value.has(item.worklog.id)).length)
const allSelected = computed(() => selectable.value.length > 0 && selectedShown.value === selectable.value.length)
const partlySelected = computed(() => selectedShown.value > 0 && !allSelected.value)

const isSubmitted = (item: ReviewItem) => item.worklog.reviewStatus === 'submitted'
const actionLabel = (item: ReviewItem) => isSubmitted(item) ? 'ตรวจ' : 'ดู'
const hoursOf = (item: ReviewItem) => formatHours(reviewMinutes(item))

function submittedLabel(item: ReviewItem) {
  const { date, time } = toThaiTimeParts(item.submittedAt)
  return `${formatThaiDayMonth(date)} • ${time} น.`
}

function onToggleAll(event: Event) {
  emit('toggleAll', selectable.value, (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <!-- จอกว้าง: ตาราง คอลัมน์ชั่วโมงและเวลาส่งแยกออกมาเมื่อกว้างพอ -->
  <div class="relative hidden overflow-x-auto rounded-lg border border-line bg-white lg:block">
    <table class="w-full min-w-[43.75rem] table-fixed border-collapse text-left">
      <thead>
        <tr class="bg-page text-2xs font-semibold text-ink-muted">
          <th class="w-12 px-1 py-1">
            <label class="flex size-10 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed">
              <input
                type="checkbox"
                class="size-4 accent-brand"
                :checked="allSelected"
                :indeterminate="partlySelected"
                :disabled="disabled || !selectable.length"
                aria-label="เลือกรายการรอตรวจทั้งหมดที่แสดง"
                @change="onToggleAll"
              >
            </label>
          </th>
          <th class="w-[15%] px-2 py-3">นักศึกษา</th>
          <th class="w-[6.5rem] px-2 py-3">วันที่</th>
          <th class="px-2 py-3">รายละเอียดงาน</th>
          <th class="w-[7.375rem] px-2 py-3">เวลา</th>
          <th class="hidden w-[5.25rem] px-2 py-3 text-right xl:table-cell">จำนวนชั่วโมง</th>
          <th class="hidden w-[8rem] py-3 pl-5 pr-2 xl:table-cell">ส่งเมื่อ</th>
          <th class="w-[7.25rem] px-2 py-3">สถานะ</th>
          <th class="w-[4.75rem] px-3 py-3"><span class="sr-only">การดำเนินการ</span></th>
        </tr>
      </thead>
      <tbody class="text-xs tabular-nums text-slate-800">
        <tr
          v-for="item in items"
          :key="item.worklog.id"
          class="border-t border-line"
          :class="selected.has(item.worklog.id) ? 'bg-indigo-50' : 'hover:bg-page'"
        >
          <td class="px-1 py-1.5">
            <label v-if="isSubmitted(item)" class="flex size-10 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed">
              <input
                type="checkbox"
                class="size-4 accent-brand"
                :checked="selected.has(item.worklog.id)"
                :disabled="disabled"
                :aria-label="`เลือก ${item.studentName} ${item.worklog.title}`"
                @change="emit('toggle', item)"
              >
            </label>
          </td>
          <td class="px-2 py-3">{{ item.studentName }}</td>
          <td class="whitespace-nowrap px-2 py-3">{{ formatThaiDate(item.worklog.date) }}</td>
          <td class="break-words px-2 py-3 font-medium">{{ item.worklog.title }}</td>
          <td class="px-2 py-3">
            <span class="whitespace-nowrap">{{ item.worklog.startTime }}–{{ item.worklog.endTime }} น.</span>
            <span class="mt-0.5 block text-2xs text-slate-600 xl:hidden">{{ hoursOf(item) }} ชม.</span>
            <TimeFlagBadges :worklog="item.worklog" class="mt-1" />
          </td>
          <td class="hidden px-2 py-3 text-right xl:table-cell">{{ hoursOf(item) }}</td>
          <td class="hidden py-3 pl-5 pr-2 xl:table-cell">{{ submittedLabel(item) }}</td>
          <td class="px-2 py-3">
            <StatusBadge v-if="item.isOverdue" :label="`ค้างตรวจ ${item.pendingDays} วัน`" tone="rose" />
            <StatusBadge v-else v-bind="reviewStatusMeta[item.worklog.reviewStatus]" />
            <span class="mt-1 block text-2xs text-slate-600 xl:hidden">ส่ง {{ submittedLabel(item) }}</span>
          </td>
          <td class="px-3 py-3 text-right">
            <button type="button" :disabled="disabled" class="btn btn-secondary min-w-12 px-3 py-1.5 text-2xs" :aria-label="`${actionLabel(item)} ${item.studentName} ${item.worklog.title}`" @click="emit('open', item)">
              {{ actionLabel(item) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- จอแคบ: รายการแบบการ์ด ไม่ต้องเลื่อนแนวนอน -->
  <div class="lg:hidden">
    <label v-if="selectable.length" class="mb-1 flex min-h-11 w-fit cursor-pointer items-center gap-3 px-3 text-xs font-medium text-slate-700">
      <input type="checkbox" class="size-4 accent-brand" :checked="allSelected" :indeterminate="partlySelected" :disabled="disabled" @change="onToggleAll">
      เลือกรายการรอตรวจทั้งหมดที่แสดง
    </label>

    <ul class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-line bg-white">
      <li v-for="item in items" :key="item.worklog.id" class="flex gap-1 py-3 pl-1 pr-3" :class="selected.has(item.worklog.id) ? 'bg-indigo-50' : ''">
        <div class="w-11 shrink-0">
          <label v-if="isSubmitted(item)" class="flex size-11 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              class="size-4 accent-brand"
              :checked="selected.has(item.worklog.id)"
              :disabled="disabled"
              :aria-label="`เลือก ${item.studentName} ${item.worklog.title}`"
              @change="emit('toggle', item)"
            >
          </label>
        </div>

        <div class="min-w-0 flex-1 pt-1">
          <p class="break-words text-[0.8125rem] font-semibold leading-snug text-ink">{{ item.worklog.title }}</p>
          <p class="mt-0.5 text-xs text-slate-600">{{ item.studentName }}</p>
          <p class="mt-1 text-2xs tabular-nums text-slate-600">
            {{ formatThaiDate(item.worklog.date) }} • {{ item.worklog.startTime }}–{{ item.worklog.endTime }} น. • {{ hoursOf(item) }} ชม.
          </p>
          <p class="text-2xs tabular-nums text-slate-600">ส่งเมื่อ {{ submittedLabel(item) }}</p>

          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1">
              <StatusBadge v-if="item.isOverdue" :label="`ค้างตรวจ ${item.pendingDays} วัน`" tone="rose" />
              <StatusBadge v-else v-bind="reviewStatusMeta[item.worklog.reviewStatus]" />
              <TimeFlagBadges :worklog="item.worklog" />
            </div>
            <button type="button" :disabled="disabled" class="btn btn-secondary min-h-10 min-w-16 px-4 text-xs" :aria-label="`${actionLabel(item)} ${item.studentName} ${item.worklog.title}`" @click="emit('open', item)">
              {{ actionLabel(item) }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
