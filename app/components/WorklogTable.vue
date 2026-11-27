<script setup lang="ts">
import type { WorkLog } from '~/types/worklog'

type FilterKey = 'all' | 'in_progress' | 'returned' | 'approved'

const props = defineProps<{
  logs: WorkLog[]
  /** วันที่ปัจจุบันของเซิร์ฟเวอร์ */
  today: string
  /** รายการที่กำลังบันทึกเวลา ระหว่างนั้นปิดปุ่มบันทึกเวลาทุกแถว */
  busyId?: number
}>()

defineEmits<{
  start: [log: WorkLog]
  finish: [log: WorkLog]
}>()

const pageSize = 10
const activeFilter = ref<FilterKey>('all')
const visibleCount = ref(pageSize)

watch(activeFilter, () => {
  visibleCount.value = pageSize
})

const filters = computed(() => [
  { key: 'all' as const, label: 'ทั้งหมด', count: props.logs.length },
  { key: 'in_progress' as const, label: 'กำลังทำ', count: props.logs.filter(log => log.workStatus === 'in_progress').length },
  { key: 'returned' as const, label: 'ส่งกลับแก้ไข', count: props.logs.filter(log => log.reviewStatus === 'returned').length },
  { key: 'approved' as const, label: 'อนุมัติแล้ว', count: props.logs.filter(log => log.reviewStatus === 'approved').length },
])

const filteredLogs = computed(() => {
  if (activeFilter.value === 'all') return props.logs
  if (activeFilter.value === 'in_progress') return props.logs.filter(log => log.workStatus === 'in_progress')
  return props.logs.filter(log => log.reviewStatus === activeFilter.value)
})

const visibleLogs = computed(() => filteredLogs.value.slice(0, visibleCount.value))

function approvedLabel(log: WorkLog) {
  if (!log.reviewedAt) return log.reviewedBy
  const { date, time } = toThaiTimeParts(log.reviewedAt)
  return `${log.reviewedBy} (${formatThaiDate(date)} • ${time} น.)`
}

function startLabel(log: WorkLog) {
  return log.startTime ? `${log.startTime} น.` : 'ยังไม่เริ่ม'
}

function endLabel(log: WorkLog) {
  if (log.endTime) return `${log.endTime} น.`
  return log.workStatus === 'in_progress' ? 'กำลังทำ...' : 'ยังไม่เริ่ม'
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div class="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h3 class="text-base font-bold text-slate-900">รายการปฏิบัติงาน</h3>
        <p class="mt-0.5 text-[11px] text-slate-500">รายการงานล่าสุดที่ได้ทำไป</p>
      </div>

      <div class="flex flex-wrap gap-2" role="group" aria-label="กรองรายการตามสถานะ">
        <button
          v-for="filter in filters"
          :key="filter.key"
          type="button"
          :aria-pressed="activeFilter === filter.key"
          class="rounded-lg px-3 py-2 text-[11px] font-semibold transition"
          :class="activeFilter === filter.key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }} ({{ filter.count }})
        </button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[760px] table-fixed border-collapse text-left">
        <thead>
          <tr class="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
            <th class="w-[112px] px-4 py-3">วันที่</th>
            <th class="px-3 py-3">หัวข้องาน</th>
            <th class="w-[86px] px-2 py-3">เวลาเริ่มงาน</th>
            <th class="w-[86px] px-2 py-3">เวลาเสร็จงาน</th>
            <th class="w-[165px] px-2 py-3">สถานะงาน / การตรวจสอบ</th>
            <th class="w-[165px] px-3 py-3 text-right">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in visibleLogs" :key="log.id" class="border-b border-slate-100 align-top last:border-0">
            <td class="whitespace-nowrap px-4 py-4 text-xs font-semibold text-slate-600">{{ formatThaiDate(log.date) }}</td>
            <td class="px-3 py-4">
              <p class="max-w-[290px] text-[13px] font-semibold leading-snug text-slate-700">{{ log.title }}</p>
              <p v-if="log.description" class="mt-1 max-w-[290px] text-[11px] leading-snug text-slate-500">{{ log.description }}</p>
              <p v-if="log.reviewStatus === 'approved' && log.reviewedBy" class="mt-1 max-w-[290px] text-[11px] leading-snug text-slate-500">
                อนุมัติโดย: {{ approvedLabel(log) }}
              </p>
              <p v-if="log.reviewStatus === 'returned' && log.reviewComment" class="mt-1 max-w-[290px] text-[11px] leading-snug text-slate-500">
                ความเห็นพี่เลี้ยง: “{{ log.reviewComment }}”
              </p>
            </td>
            <td class="px-2 py-4 font-medium" :class="log.startTime ? 'text-xs text-slate-600' : 'text-[11px] text-slate-500'">{{ startLabel(log) }}</td>
            <td class="px-2 py-4 font-medium" :class="log.endTime || log.workStatus === 'in_progress' ? 'text-xs text-slate-600' : 'text-[11px] text-slate-500'">{{ endLabel(log) }}</td>
            <td class="px-2 py-4">
              <div class="flex flex-wrap gap-1.5">
                <StatusBadge :label="workStatusMeta[log.workStatus].label" :tone="workStatusMeta[log.workStatus].tone" />
                <StatusBadge :label="reviewStatusMeta[log.reviewStatus].label" :tone="reviewStatusMeta[log.reviewStatus].tone" />
              </div>
            </td>
            <td class="px-3 py-4">
              <div class="flex flex-col items-end gap-1.5">
                <NuxtLink
                  v-if="log.reviewStatus === 'returned' && log.canEdit !== false"
                  :to="`/worklogs/${log.id}/edit`"
                  class="btn btn-secondary px-3 py-1.5 text-[11px]"
                >
                  แก้ไข &amp; ส่งตรวจใหม่
                </NuxtLink>

                <button
                  v-else-if="log.reviewStatus === 'returned'"
                  type="button"
                  disabled
                  title="เลยกำหนดแก้ไขหลังถูกส่งกลับแล้ว แก้ไขและส่งใหม่ไม่ได้"
                  class="btn btn-secondary px-3 py-1.5 text-[11px]"
                >
                  แก้ไข &amp; ส่งตรวจใหม่
                </button>

                <button
                  v-else-if="log.reviewStatus === 'draft' && log.workStatus === 'pending'"
                  type="button"
                  :disabled="log.canEdit === false || busyId !== undefined"
                  :title="log.canEdit === false ? 'เกินช่วงย้อนหลังแล้ว' : undefined"
                  :aria-label="`เริ่มทำงาน ${log.title}`"
                  class="btn btn-start px-3 py-1.5 text-[11px]"
                  @click="$emit('start', log)"
                >
                  <UIcon :name="busyId === log.id ? 'i-lucide-loader-circle' : 'i-lucide-play'" class="size-3.5" :class="busyId === log.id ? 'animate-spin' : ''" />
                  เริ่มทำงาน
                </button>

                <template v-else-if="log.reviewStatus === 'draft' && log.workStatus === 'in_progress'">
                  <!-- ข้ามวันแล้วกดจบงานไม่ได้ ต้องกรอกเวลาเองในหน้าแก้ไข -->
                  <NuxtLink
                    v-if="log.date !== today && log.canEdit !== false"
                    :to="`/worklogs/${log.id}/edit`"
                    class="btn btn-secondary px-3 py-1.5 text-[11px]"
                  >
                    กรอกเวลาสิ้นสุด
                  </NuxtLink>
                  <button
                    v-else
                    type="button"
                    :disabled="log.canEdit === false || busyId !== undefined"
                    :title="log.canEdit === false ? 'เกินช่วงย้อนหลังแล้ว' : undefined"
                    :aria-label="`ทำงานเสร็จสิ้น ${log.title}`"
                    class="btn btn-done px-3 py-1.5 text-[11px]"
                    @click="$emit('finish', log)"
                  >
                    <UIcon :name="busyId === log.id ? 'i-lucide-loader-circle' : 'i-lucide-check'" class="size-3.5" :class="busyId === log.id ? 'animate-spin' : ''" />
                    ทำงานเสร็จสิ้น
                  </button>
                  <button type="button" disabled title="ส่งตรวจได้หลังทำงานเสร็จสิ้น" class="btn btn-primary px-3 py-1.5 text-[11px]">ส่งตรวจ (ล็อก)</button>
                </template>

                <!-- ส่งตรวจต้องมีไฟล์แนบ จึงไปทำต่อในหน้าแก้ไข -->
                <NuxtLink
                  v-else-if="log.reviewStatus === 'draft' && log.canEdit !== false"
                  :to="`/worklogs/${log.id}/edit`"
                  class="btn btn-primary px-3 py-1.5 text-[11px]"
                >
                  แนบไฟล์ &amp; ส่งตรวจ
                </NuxtLink>

                <NuxtLink v-else :to="`/worklogs/${log.id}/history`" class="btn btn-secondary px-3 py-1.5 text-[11px]">
                  ดูรายละเอียด
                </NuxtLink>

                <!-- ปุ่มด้านบนกดไม่ได้เมื่อเลยกำหนดแก้ไข ต้องมีทางไปดูและลบรายการ -->
                <NuxtLink
                  v-if="log.canEdit === false && (log.reviewStatus === 'returned' || (log.reviewStatus === 'draft' && log.workStatus !== 'done'))"
                  :to="`/worklogs/${log.id}/history`"
                  :aria-label="`ดูประวัติ ${log.title}`"
                  class="text-[11px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                >
                  ดูประวัติ
                </NuxtLink>
              </div>
            </td>
          </tr>
          <tr v-if="filteredLogs.length === 0">
            <td colspan="6" class="px-5 py-12 text-center text-sm text-slate-500">ไม่มีรายการในสถานะนี้</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="filteredLogs.length > pageSize" class="flex items-center justify-center gap-3 border-t border-slate-100 py-3 text-[11px] text-slate-500">
      <span>แสดง {{ visibleLogs.length }} จาก {{ filteredLogs.length }} รายการ</span>
      <button v-if="visibleLogs.length < filteredLogs.length" type="button" class="font-semibold text-indigo-600 underline underline-offset-2" @click="visibleCount += pageSize">
        แสดงเพิ่ม
      </button>
    </div>
  </section>
</template>
