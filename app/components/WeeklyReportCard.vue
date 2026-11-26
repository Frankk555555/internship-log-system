<script setup lang="ts">
import type { WeeklyReport } from '~/utils/weeklyReport'

const props = defineProps<{
  report: WeeklyReport
  weekLabel: string
}>()

const pendingLabel = computed(() => props.report.rows.some(row => row.status === 'draft')
  ? 'ฉบับร่าง/รออนุมัติ/ส่งกลับ'
  : 'รออนุมัติ/ส่งกลับ')
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-7 print:border-0 print:p-0 print:shadow-none">
    <h3 class="text-lg font-bold text-slate-900">สรุปรายงานประจำสัปดาห์</h3>

    <dl class="mt-4 grid gap-3 sm:grid-cols-[1.25fr_1fr_1.25fr] print:grid-cols-[1.25fr_1fr_1.25fr]">
      <div>
        <dt class="text-[11px] text-slate-400">ชื่อนักศึกษา</dt>
        <dd class="mt-0.5 text-xs text-slate-800">{{ report.label }}</dd>
      </div>
      <div>
        <dt class="text-[11px] text-slate-400">ชื่อพี่เลี้ยง</dt>
        <dd class="mt-0.5 text-xs text-slate-800">{{ report.mentorName }}</dd>
      </div>
      <div>
        <dt class="text-[11px] text-slate-400">ช่วงวันที่</dt>
        <dd class="mt-0.5 text-xs text-slate-800">{{ weekLabel }}</dd>
      </div>
    </dl>

    <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 print:overflow-visible">
      <table class="w-full min-w-[640px] table-fixed border-collapse text-left print:min-w-0">
        <thead>
          <tr class="bg-slate-100 text-[11px] font-semibold text-slate-500">
            <th class="w-[14%] px-4 py-3">วันที่</th>
            <th class="px-3 py-3">รายการงาน</th>
            <th class="w-[17%] px-3 py-3">เวลา</th>
            <th class="w-[8%] px-3 py-3">ชม.</th>
            <th class="w-[18%] px-3 py-3">สถานะการตรวจสอบ</th>
          </tr>
        </thead>
        <tbody class="text-xs text-slate-800">
          <tr v-for="row in report.rows" :key="row.id" class="break-inside-avoid border-t border-slate-200">
            <td class="px-4 py-3">{{ row.date }}</td>
            <td class="px-3 py-3">{{ row.title }}</td>
            <td class="px-3 py-3">{{ row.time }}</td>
            <td class="px-3 py-3">{{ row.minutes === undefined ? '–' : formatHours(row.minutes) }}</td>
            <td class="px-3 py-3">
              <StatusBadge
                :label="reportStatusLabels[row.status]"
                :tone="reviewStatusMeta[row.status].tone"
                :solid="row.status === 'approved' || row.status === 'submitted'"
              />
            </td>
          </tr>
          <tr v-if="report.rows.length === 0" class="border-t border-slate-200">
            <td colspan="5" class="px-5 py-12 text-center text-sm text-slate-400">ไม่มีรายการงานในสัปดาห์นี้</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-2 flex break-inside-avoid items-center justify-between gap-3 rounded-lg bg-indigo-50 px-4 py-3">
      <p class="text-xs font-semibold text-slate-900">ชั่วโมงรวม (นับเฉพาะรายการที่อนุมัติแล้ว)</p>
      <p class="text-base font-bold text-indigo-600">{{ formatHours(report.approvedMinutes) }} ชม.</p>
    </div>

    <p class="mt-3 text-[11px] text-slate-400">
      ทั้งหมด {{ formatHours(report.totalMinutes) }} ชม. · {{ pendingLabel }} {{ formatHours(report.totalMinutes - report.approvedMinutes) }} ชม. (ไม่นับรวม)
    </p>
  </section>
</template>
