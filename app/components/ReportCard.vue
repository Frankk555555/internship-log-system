<script setup lang="ts">
import type { Report, ReportPeriod } from '~/utils/report'

const props = defineProps<{
  report: Report
  period: ReportPeriod
  /** รายงานของผู้ที่เข้าสู่ระบบเอง ชื่อและช่วงวันที่เห็นบนหน้าจออยู่แล้ว แสดงเฉพาะในเอกสารที่พิมพ์ */
  own?: boolean
}>()

const pendingLabel = computed(() => props.report.rows.some(row => row.status === 'draft')
  ? 'ฉบับร่าง/รอตรวจ/ส่งกลับแก้ไข'
  : 'รอตรวจ/ส่งกลับแก้ไข')

const isYear = computed(() => props.period.view === 'year')
const hoursOrDash = (minutes: number) => minutes ? formatHours(minutes) : '–'

// ตารางกว้างกว่ากรอบ ให้กรอบรับโฟกัส จะเลื่อนด้วยปุ่มลูกศรได้
const scroller = useTemplateRef<HTMLElement>('scroller')
const isScrollable = ref(false)
let observer: ResizeObserver | undefined

onMounted(() => {
  const element = scroller.value
  if (!element) return
  observer = new ResizeObserver(() => {
    isScrollable.value = element.scrollWidth > element.clientWidth
  })
  observer.observe(element)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section class="card p-5  lg:p-7 print:border-0 print:p-0 print:shadow-none">
    <h2 class="text-base font-bold text-ink">สรุป{{ period.name }}</h2>

    <!-- เอกสาร PDF ไม่มีเมนูและตัวเลือกช่วงเวลา จึงต้องบอกว่าเป็นรายงานของใครและช่วงใด -->
    <dl class="mt-4 gap-3 sm:grid-cols-[1.25fr_1fr_1.25fr] print:grid-cols-[1.25fr_1fr_1.25fr]" :class="own ? 'hidden print:grid' : 'grid'">
      <div>
        <dt class="text-2xs text-ink-muted">ชื่อนักศึกษา</dt>
        <dd class="mt-0.5 text-xs text-slate-800">{{ report.label }}</dd>
      </div>
      <div>
        <dt class="text-2xs text-ink-muted">ชื่อพี่เลี้ยง</dt>
        <dd class="mt-0.5 text-xs text-slate-800">{{ report.mentorName }}</dd>
      </div>
      <div>
        <dt class="text-2xs text-ink-muted">{{ period.rangeTitle }}</dt>
        <dd class="mt-0.5 text-xs text-slate-800">{{ period.label }}</dd>
      </div>
    </dl>

    <div
      ref="scroller"
      :tabindex="isScrollable ? 0 : undefined"
      :role="isScrollable ? 'region' : undefined"
      :aria-label="isScrollable ? `ตารางรายงานของ ${report.label} เลื่อนดูได้` : undefined"
      class="mt-4 overflow-x-auto rounded-lg border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand print:overflow-visible"
    >
      <!-- รายปี: สรุปรายเดือน รายการทั้งหมดอยู่ในไฟล์ Excel -->
      <table v-if="isYear" class="w-full min-w-[30rem] table-fixed border-collapse text-left print:min-w-0">
        <thead>
          <tr class="bg-page text-2xs font-semibold text-ink-muted">
            <th class="px-4 py-3">เดือน</th>
            <th class="w-[22%] px-3 py-3 text-right">จำนวนรายการ</th>
            <th class="w-[22%] px-3 py-3 text-right">ชม. ทั้งหมด</th>
            <th class="w-[22%] py-3 pl-3 pr-4 text-right">ชม. ที่อนุมัติ</th>
          </tr>
        </thead>
        <tbody class="text-xs tabular-nums text-slate-800">
          <tr v-for="month in report.months" :key="month.month" class="break-inside-avoid border-t border-line" :class="month.count ? '' : 'text-ink-muted'">
            <th scope="row" class="px-4 py-2.5 font-normal">{{ month.month }}</th>
            <td class="px-3 py-2.5 text-right">{{ month.count || '–' }}</td>
            <td class="px-3 py-2.5 text-right">{{ hoursOrDash(month.totalMinutes) }}</td>
            <td class="py-2.5 pl-3 pr-4 text-right">{{ hoursOrDash(month.approvedMinutes) }}</td>
          </tr>
          <tr class="break-inside-avoid border-t border-line bg-page font-semibold">
            <th scope="row" class="px-4 py-3 text-left">รวมทั้งปี</th>
            <td class="px-3 py-3 text-right">{{ report.rows.length }}</td>
            <td class="px-3 py-3 text-right">{{ formatHours(report.totalMinutes) }}</td>
            <td class="py-3 pl-3 pr-4 text-right">{{ formatHours(report.approvedMinutes) }}</td>
          </tr>
        </tbody>
      </table>

      <table v-else class="w-full min-w-[40rem] table-fixed border-collapse text-left print:min-w-0">
        <thead>
          <tr class="bg-page text-2xs font-semibold text-ink-muted">
            <th class="w-[14%] px-4 py-3">วันที่</th>
            <th class="px-3 py-3">รายการงาน</th>
            <th class="w-[17%] px-3 py-3">เวลา</th>
            <th class="w-[8%] px-3 py-3">ชม.</th>
            <th class="w-[18%] px-3 py-3">สถานะการตรวจสอบ</th>
          </tr>
        </thead>
        <tbody class="text-xs text-slate-800">
          <tr v-for="row in report.rows" :key="row.id" class="break-inside-avoid border-t border-line">
            <td class="whitespace-nowrap px-4 py-3 align-top">{{ row.date }}</td>
            <td class="break-words px-3 py-3 align-top">
              {{ row.title }}
              <!-- รายวันมีที่พอแสดงรายละเอียดงาน -->
              <p v-if="period.view === 'day' && row.description" class="mt-1 whitespace-pre-line text-2xs text-slate-600">{{ row.description }}</p>
            </td>
            <td class="px-3 py-3 align-top">{{ row.time }}</td>
            <td class="px-3 py-3 align-top">{{ row.minutes === undefined ? '–' : formatHours(row.minutes) }}</td>
            <td class="px-3 py-3 align-top">
              <StatusBadge v-bind="reviewStatusMeta[row.status]" />
            </td>
          </tr>
          <tr v-if="report.rows.length === 0" class="border-t border-line">
            <td colspan="5" class="px-5 py-12 text-center text-sm text-ink-muted">{{ period.empty }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-2 flex break-inside-avoid items-center justify-between gap-3 rounded-lg bg-indigo-50 px-4 py-3">
      <p class="text-xs font-semibold text-ink">ชั่วโมงรวม (นับเฉพาะรายการที่อนุมัติแล้ว)</p>
      <p class="text-base font-bold text-brand">{{ formatHours(report.approvedMinutes) }} ชม.</p>
    </div>

    <p class="mt-3 text-2xs text-ink-muted">
      ทั้งหมด {{ formatHours(report.totalMinutes) }} ชม. · {{ pendingLabel }} {{ formatHours(report.totalMinutes - report.approvedMinutes) }} ชม. (ไม่นับรวม)
    </p>
  </section>
</template>
