<script setup lang="ts">
import type { WorkLog } from '~/types/worklog'

type FilterKey = 'all' | 'in_progress' | 'returned' | 'approved'

const props = defineProps<{
  logs: WorkLog[]
}>()

const activeFilter = ref<FilterKey>('all')

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
        <h3 class="text-sm font-semibold text-slate-800">รายการปฏิบัติงาน</h3>
        <p class="mt-0.5 text-[11px] text-slate-400">รายการงานล่าสุดที่ได้ทำไป</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="filter in filters"
          :key="filter.key"
          type="button"
          class="rounded-lg px-3 py-2 text-[11px] font-semibold transition"
          :class="activeFilter === filter.key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }} ({{ filter.count }})
        </button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[760px] table-fixed border-collapse text-left">
        <thead>
          <tr class="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
            <th class="w-[72px] px-4 py-3">วันที่</th>
            <th class="px-3 py-3">หัวข้องาน</th>
            <th class="w-[86px] px-2 py-3">เวลาเริ่มงาน</th>
            <th class="w-[86px] px-2 py-3">เวลาเสร็จงาน</th>
            <th class="w-[165px] px-2 py-3">สถานะงาน / การตรวจสอบ</th>
            <th class="w-[165px] px-3 py-3 text-right">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in filteredLogs" :key="log.id" class="border-b border-slate-100 align-top last:border-0">
            <td class="px-4 py-4 text-xs font-semibold text-slate-600">{{ formatThaiDate(log.date) }}</td>
            <td class="px-3 py-4">
              <p class="max-w-[290px] text-[13px] font-semibold leading-snug text-slate-700">{{ log.title }}</p>
              <p v-if="log.description" class="mt-1 max-w-[290px] text-[11px] leading-snug text-slate-400">{{ log.description }}</p>
              <p v-if="log.reviewStatus === 'returned' && log.reviewComment" class="mt-1 max-w-[290px] text-[11px] leading-snug text-slate-400">
                ความเห็นพี่เลี้ยง: “{{ log.reviewComment }}”
              </p>
            </td>
            <td class="px-2 py-4 text-xs font-medium" :class="log.startTime ? 'text-slate-600' : 'text-slate-300'">{{ startLabel(log) }}</td>
            <td class="px-2 py-4 text-xs font-medium" :class="log.endTime || log.workStatus === 'in_progress' ? 'text-slate-600' : 'text-slate-300'">{{ endLabel(log) }}</td>
            <td class="px-2 py-4">
              <div class="flex flex-wrap gap-1.5">
                <StatusBadge :label="workStatusMeta[log.workStatus].label" :tone="workStatusMeta[log.workStatus].tone" />
                <StatusBadge :label="reviewStatusMeta[log.reviewStatus].label" :tone="reviewStatusMeta[log.reviewStatus].tone" />
              </div>
            </td>
            <td class="px-3 py-4">
              <div class="flex flex-col items-end gap-1.5">
                <button v-if="log.workStatus === 'pending'" type="button" class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700">
                  <UIcon name="i-lucide-play" class="size-3.5" />
                  เริ่มทำงาน (บันทึกเวลาเข้างาน)
                </button>

                <template v-else-if="log.workStatus === 'in_progress'">
                  <button type="button" class="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700">
                    <UIcon name="i-lucide-check" class="size-3.5" />
                    ทำงานเสร็จสิ้น
                  </button>
                  <button type="button" class="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-400">ส่งตรวจ (เลือก)</button>
                </template>

                <NuxtLink
                  v-else-if="log.reviewStatus === 'returned' && log.canEdit !== false"
                  :to="`/worklogs/${log.id}/edit`"
                  class="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  แก้ไข &amp; ส่งตรวจใหม่
                </NuxtLink>

                <button
                  v-else-if="log.reviewStatus === 'returned'"
                  type="button"
                  disabled
                  title="เกินช่วงย้อนหลังแล้ว แก้ไขและส่งใหม่ไม่ได้"
                  class="cursor-not-allowed rounded-lg bg-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
                >
                  แก้ไข &amp; ส่งตรวจใหม่
                </button>

                <button v-else type="button" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm hover:bg-slate-50">
                  ดูรายละเอียด (เลือก)
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredLogs.length === 0">
            <td colspan="6" class="px-5 py-12 text-center text-sm text-slate-400">ไม่มีรายการในสถานะนี้</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
