<script setup lang="ts">
import type { ReviewItem } from '~/types/review'

const props = defineProps<{
  /** งานรอตรวจทั้งหมดเลือกได้ */
  items: ReviewItem[]
  /** id ของรายการที่เลือกไว้ */
  selectedIds: number[]
  /** ระหว่างส่งผลการตรวจ ปิดการเลือกและการเปิดรายการ */
  disabled?: boolean
}>()

const emit = defineEmits<{
  toggle: [item: ReviewItem]
  /** เลือกหรือยกเลิกทุกรายการที่แสดงอยู่ */
  toggleAll: [items: ReviewItem[], checked: boolean]
  open: [item: ReviewItem]
}>()

const selected = computed(() => new Set(props.selectedIds))
const selectedShown = computed(() => props.items.filter(item => selected.value.has(item.worklog.id)).length)
const allSelected = computed(() => props.items.length > 0 && selectedShown.value === props.items.length)
const partlySelected = computed(() => selectedShown.value > 0 && !allSelected.value)

const attachmentLabel = (item: ReviewItem) => item.worklog.attachments?.length ? `แนบ ${item.worklog.attachments.length} ไฟล์` : 'ไม่มีไฟล์แนบ'
const timeLabel = (item: ReviewItem) => `${item.worklog.startTime}–${item.worklog.endTime} น.`
const hoursLabel = (item: ReviewItem) => `${formatHours(reviewMinutes(item))} ชม.`
const waitingLabel = (item: ReviewItem) => item.pendingDays ? `รอ ${item.pendingDays} วัน` : 'ส่งวันนี้'
const openLabel = (item: ReviewItem) => `ตรวจ ${item.studentName} ${item.worklog.title}`

function onToggleAll(event: Event) {
  emit('toggleAll', props.items, (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <!-- จอกว้าง: ตาราง -->
  <div class="relative hidden overflow-x-auto border-t border-line lg:block">
    <table class="w-full min-w-[44rem] table-fixed border-collapse text-left">
      <thead>
        <tr class="bg-page text-2xs font-semibold text-slate-600">
          <th class="w-14 px-2 py-1">
            <label class="flex size-10 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed">
              <input
                type="checkbox"
                class="size-4 accent-brand"
                :checked="allSelected"
                :indeterminate="partlySelected"
                :disabled="disabled"
                aria-label="เลือกทุกรายการที่แสดง"
                @change="onToggleAll"
              >
            </label>
          </th>
          <th class="w-[19%] px-2 py-3">นักศึกษา</th>
          <th class="px-2 py-3">งาน</th>
          <th class="w-[11rem] px-2 py-3">วันที่และเวลา</th>
          <th class="w-[8.5rem] px-2 py-3">รอตรวจ</th>
          <th class="w-[5.5rem] px-3 py-3"><span class="sr-only">การดำเนินการ</span></th>
        </tr>
      </thead>
      <tbody class="text-xs tabular-nums text-slate-600">
        <tr v-for="item in items" :key="item.worklog.id" class="border-t border-line align-middle" :class="selected.has(item.worklog.id) ? 'bg-indigo-50' : 'hover:bg-page'">
          <td class="px-2 py-1.5">
            <label class="flex size-10 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed">
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
          <td class="px-2 py-3.5">
            <p class="break-words font-semibold text-ink">{{ item.studentName }}</p>
            <p class="mt-0.5 break-all text-2xs">{{ item.studentId }}</p>
          </td>
          <td class="px-2 py-3.5">
            <p class="break-words font-semibold text-ink">{{ item.worklog.title }}</p>
            <p class="mt-0.5 text-2xs">{{ attachmentLabel(item) }}</p>
            <TimeFlagBadges :worklog="item.worklog" class="mt-1" />
          </td>
          <td class="px-2 py-3.5">
            <p class="font-semibold text-ink">{{ formatThaiDate(item.worklog.date) }}</p>
            <p class="mt-0.5 text-2xs">{{ timeLabel(item) }} <span class="whitespace-nowrap">{{ hoursLabel(item) }}</span></p>
          </td>
          <td class="px-2 py-3.5">
            <StatusBadge v-if="item.isOverdue" :label="`${waitingLabel(item)} ค้างตรวจ`" tone="rose" />
            <span v-else>{{ waitingLabel(item) }}</span>
          </td>
          <td class="px-3 py-3.5 text-right">
            <button type="button" :disabled="disabled" class="btn btn-secondary min-w-14 px-3 py-1.5 text-2xs" :aria-label="openLabel(item)" @click="emit('open', item)">
              ตรวจ
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- จอแคบ: รายการแบบการ์ด ไม่ต้องเลื่อนแนวนอน -->
  <div class="border-t border-line lg:hidden">
    <label class="flex min-h-11 w-fit cursor-pointer items-center gap-3 px-4 text-xs font-medium text-slate-700">
      <input type="checkbox" class="size-4 accent-brand" :checked="allSelected" :indeterminate="partlySelected" :disabled="disabled" @change="onToggleAll">
      เลือกทุกรายการที่แสดง
    </label>

    <ul class="divide-y divide-slate-200 border-t border-line">
      <li v-for="item in items" :key="item.worklog.id" class="flex gap-1 py-3 pl-2 pr-4" :class="selected.has(item.worklog.id) ? 'bg-indigo-50' : ''">
        <label class="flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            class="size-4 accent-brand"
            :checked="selected.has(item.worklog.id)"
            :disabled="disabled"
            :aria-label="`เลือก ${item.studentName} ${item.worklog.title}`"
            @change="emit('toggle', item)"
          >
        </label>

        <div class="min-w-0 flex-1 pt-1">
          <p class="break-words text-[0.8125rem] font-semibold leading-snug text-ink">{{ item.worklog.title }}</p>
          <p class="mt-0.5 break-words text-xs text-slate-600">{{ item.studentName }} {{ item.studentId }}</p>
          <p class="mt-1 text-2xs tabular-nums text-slate-600">
            {{ formatThaiDate(item.worklog.date) }} • {{ timeLabel(item) }} • {{ hoursLabel(item) }}
          </p>
          <p class="text-2xs text-slate-600">{{ attachmentLabel(item) }}</p>

          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1">
              <StatusBadge v-if="item.isOverdue" :label="`${waitingLabel(item)} ค้างตรวจ`" tone="rose" />
              <span v-else class="text-2xs tabular-nums text-slate-600">{{ waitingLabel(item) }}</span>
              <TimeFlagBadges :worklog="item.worklog" />
            </div>
            <button type="button" :disabled="disabled" class="btn btn-secondary min-h-10 min-w-16 px-4 text-xs" :aria-label="openLabel(item)" @click="emit('open', item)">
              ตรวจ
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
