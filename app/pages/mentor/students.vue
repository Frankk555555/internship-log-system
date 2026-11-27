<script setup lang="ts">
definePageMeta({ layout: 'staff', role: 'supervisor' })
useHead({ title: 'นักศึกษาในความดูแล' })

const api = useApi()

// พี่เลี้ยงเห็นเฉพาะนักศึกษาในความดูแลของตน (ขอบเขตงานข้อ 2.3, 9.2)
const { data, status, error, refresh } = await useLazyAsyncData('supervised-students', () => api.getSupervisedStudents())

const search = ref('')
const students = computed(() => data.value?.students ?? [])
const visibleStudents = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return students.value
  return students.value.filter(student => student.name.toLowerCase().includes(keyword) || student.studentId.includes(keyword))
})

const totals = computed(() => students.value.reduce(
  (sum, student) => ({
    pending: sum.pending + student.pendingCount,
    overdue: sum.overdue + student.overdueCount,
  }),
  { pending: 0, overdue: 0 },
))

// ช่วงฝึกงานกำหนดรายคน (ขอบเขตงานข้อ 3.3) การ์ดสรุปแสดงช่วงรวมของทุกคน
const period = computed(() => {
  if (!students.value.length) return undefined
  const starts = students.value.map(student => student.startDate).sort()
  const ends = students.value.map(student => student.endDate).sort()
  return {
    start: starts[0]!,
    end: ends.at(-1)!,
    isMixed: starts[0] !== starts.at(-1) || ends[0] !== ends.at(-1),
  }
})

function submittedLabel(value: string) {
  const { date, time } = toThaiTimeParts(value)
  return `${formatThaiDayMonth(date)} • ${time} น.`
}
</script>

<template>
  <div>
    <PageHeader
      title="นักศึกษาในความดูแล"
      description="รายชื่อที่ได้รับมอบหมายในช่วงฝึกงานนี้"
      :crumbs="[{ label: 'พื้นที่พี่เลี้ยง' }, { label: 'นักศึกษาในความดูแล' }]"
    >
      <template #actions>
        <NotificationButton />
      </template>
    </PageHeader>

    <div class="mt-4">
      <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
        <template v-if="data">
          <div class="grid gap-4 md:grid-cols-[1fr_1.4fr_1.2fr]">
            <!-- ค่าอยู่กึ่งกลางพื้นที่ใต้ชื่อการ์ด -->
            <section class="card flex flex-col p-4 text-center">
              <p class="text-xs font-semibold text-slate-600">นักศึกษาที่อยู่ในความดูแล</p>
              <div class="flex flex-1 items-center justify-center">
                <p class="flex items-baseline gap-2 text-lg font-semibold text-ink"><span class="text-[2rem] font-bold leading-none tabular-nums">{{ students.length }}</span> คน</p>
              </div>
            </section>

            <!-- ขนาดวันที่ปรับตามความกว้างการ์ด (หน่วย cqi) การ์ดแคบเรียงวันที่ลงมาเป็นแนวตั้ง -->
            <section class="card @container flex flex-col p-4 text-center">
              <p class="text-xs font-semibold text-slate-600">ระยะเวลาฝึกงาน</p>
              <div class="flex flex-1 flex-col items-center justify-center">
                <p v-if="period" class="flex flex-col items-center text-2xl font-bold leading-snug tabular-nums text-ink @sm:flex-row @sm:flex-wrap @sm:items-baseline @sm:justify-center @sm:gap-x-2 @sm:text-[clamp(1.25rem,6.5cqi,2rem)]">
                  <span class="whitespace-nowrap">{{ formatThaiDate(period.start) }}</span>
                  <span class="text-sm font-semibold text-slate-600">ถึง</span>
                  <span class="whitespace-nowrap">{{ formatThaiDate(period.end) }}</span>
                </p>
                <p v-else class="text-4xl font-bold text-ink-muted">–</p>
                <p v-if="period?.isMixed" class="mt-1 text-2xs text-slate-600">ช่วงฝึกงานต่างกันรายคน ดูในตาราง</p>
              </div>
            </section>

            <section class="card p-4" aria-labelledby="pending-title">
              <p id="pending-title" class="text-xs font-semibold text-slate-600">รายการรอตรวจ</p>
              <div class="mt-1 flex flex-wrap items-center justify-between gap-3">
                <p class="text-xs font-semibold text-ink"><span class="text-3xl font-bold tabular-nums" :class="totals.pending ? 'text-amber-700' : ''">{{ totals.pending }}</span> รายการ</p>
                <NuxtLink v-if="totals.pending" to="/mentor/reviews" class="btn btn-primary min-h-9 px-4 text-xs">ไปตรวจงาน</NuxtLink>
              </div>
              <!-- สองแถวรวมกันเท่ากับจำนวนรอตรวจด้านบน -->
              <dl v-if="totals.pending" class="mt-2 space-y-1 text-xs">
                <div class="flex items-center justify-between gap-3 rounded-lg px-3 py-1" :class="totals.overdue ? 'bg-rose-100 font-bold text-rose-700' : 'bg-page text-slate-600'">
                  <dt>ค้างตรวจเกิน {{ data.overdueDays }} วัน</dt>
                  <dd class="whitespace-nowrap tabular-nums">{{ totals.overdue }} รายการ</dd>
                </div>
                <div class="flex items-center justify-between gap-3 rounded-lg bg-page px-3 py-1 text-slate-600">
                  <dt>รอตรวจไม่เกิน {{ data.overdueDays }} วัน</dt>
                  <dd class="whitespace-nowrap tabular-nums">{{ totals.pending - totals.overdue }} รายการ</dd>
                </div>
              </dl>
              <p v-else class="mt-3 text-xs text-ink-muted">ไม่มีรายการรอตรวจ</p>
            </section>
          </div>

          <section class="mt-4 overflow-hidden card" aria-labelledby="student-list-title">
            <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 id="student-list-title" class="text-base font-bold text-ink">รายชื่อนักศึกษา</h2>
              <label class="relative block">
                <span class="sr-only">ค้นหาชื่อหรือรหัสนักศึกษา</span>
                <UIcon name="i-lucide-search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
                <input v-model="search" type="search" placeholder="ค้นหาชื่อหรือรหัสนักศึกษา" class="field h-9 w-64 bg-white pl-9 pr-3 text-xs text-slate-800">
              </label>
            </div>

            <!-- relative: ข้อความสำหรับโปรแกรมอ่านหน้าจอในตารางไม่ดันหน้าให้กว้างเกิน -->
            <div class="relative overflow-x-auto border-t border-line">
              <table class="w-full min-w-[50rem] table-fixed border-collapse text-left">
                <thead>
                  <tr class="bg-page text-2xs font-semibold text-slate-600">
                    <th class="w-[22%] px-5 py-3">นักศึกษา</th>
                    <th class="px-2 py-3">ที่ฝึกงาน</th>
                    <th class="w-[9%] px-1 py-3 text-center">รอตรวจ</th>
                    <th class="w-[9%] px-1 py-3 text-center">ค้างตรวจ<span class="block font-medium">เกิน {{ data.overdueDays }} วัน</span></th>
                    <th class="w-[11%] px-1 py-3 text-center">ส่งกลับแก้ไข</th>
                    <th class="w-[10%] px-1 py-3 text-center">ชั่วโมงอนุมัติ</th>
                    <th class="w-[8rem] px-3 py-3"><span class="sr-only">การดำเนินการ</span></th>
                  </tr>
                </thead>
                <tbody class="text-xs text-slate-600">
                  <tr v-for="student in visibleStudents" :key="student.studentId" class="border-t border-line align-middle hover:bg-page">
                    <td class="px-5 py-4">
                      <p class="text-sm font-bold text-ink">{{ student.name }}</p>
                      <p class="mt-0.5 tabular-nums">รหัส {{ student.studentId }}</p>
                      <a :href="`mailto:${student.email}`" class="mt-0.5 block break-all text-2xs text-slate-600 hover:text-brand">{{ student.email }}</a>
                      <p class="mt-1.5 text-2xs text-slate-600">
                        {{ student.lastSubmittedAt ? `ส่งล่าสุด ${submittedLabel(student.lastSubmittedAt)}` : 'ยังไม่เคยส่งตรวจ' }}
                      </p>
                    </td>
                    <td class="px-2 py-4">
                      <p class="font-semibold text-ink">{{ student.company }}</p>
                      <p class="mt-0.5">{{ student.position }}</p>
                      <p class="mt-1.5 text-2xs">
                        <span class="whitespace-nowrap">{{ formatThaiDate(student.startDate) }}</span>
                        ถึง <span class="whitespace-nowrap">{{ formatThaiDate(student.endDate) }}</span>
                      </p>
                    </td>
                    <!-- จำนวนงานแยกคอลัมน์ เทียบระหว่างนักศึกษาได้ในแนวตั้ง -->
                    <td class="px-1 py-4 text-center">
                      <NuxtLink
                        v-if="student.pendingCount"
                        :to="{ path: '/mentor/reviews', query: { student: student.studentId } }"
                        class="inline-flex min-h-8 min-w-14 items-center justify-center gap-1 rounded-full border border-amber-700/40 bg-amber-100 pl-3 pr-2 text-sm font-bold tabular-nums text-amber-700 hover:border-amber-700"
                        :aria-label="`ตรวจรายการรอตรวจของ ${student.name} จำนวน ${student.pendingCount} รายการ`"
                      >
                        {{ student.pendingCount }}
                        <UIcon name="i-lucide-chevron-right" class="size-3.5" />
                      </NuxtLink>
                      <span v-else class="text-sm tabular-nums text-slate-600">0</span>
                    </td>
                    <td v-for="(count, index) in [student.overdueCount, student.returnedCount]" :key="index" class="px-1 py-4 text-center">
                      <span v-if="count" class="inline-flex min-h-8 min-w-10 items-center justify-center rounded-full bg-rose-100 px-3 text-sm font-bold tabular-nums text-rose-700">{{ count }}</span>
                      <span v-else class="text-sm tabular-nums text-slate-600">0</span>
                    </td>
                    <td class="whitespace-nowrap px-1 py-4 text-center text-sm font-bold tabular-nums text-ink">{{ formatHours(student.approvedMinutes) }} <span class="text-xs font-semibold text-slate-600">ชม.</span></td>
                    <td class="px-3 py-4">
                      <!-- ปุ่มแบบเดียวกับปุ่ม "ตรวจ" ในหน้าตรวจงาน สองปุ่มกว้างเท่ากัน -->
                      <div class="ml-auto flex w-fit flex-col gap-1.5">
                        <NuxtLink :to="{ path: '/mentor/reviews', query: { student: student.studentId, tab: 'all' } }" class="btn btn-secondary min-w-12 whitespace-nowrap px-3 py-1.5 text-2xs" :aria-label="`ดูบันทึกงานของ ${student.name}`">
                          ดูบันทึกงาน
                        </NuxtLink>
                        <NuxtLink :to="{ path: '/mentor/reports', query: { student: student.studentId } }" class="btn btn-secondary min-w-12 whitespace-nowrap px-3 py-1.5 text-2xs" :aria-label="`รายงานรายสัปดาห์ของ ${student.name}`">
                          รายงาน
                        </NuxtLink>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!visibleStudents.length" class="border-t border-slate-100">
                    <td colspan="7" class="px-5 py-12 text-center text-sm text-ink-muted">{{ students.length ? 'ไม่พบนักศึกษาที่ตรงกับคำค้น' : 'ยังไม่มีนักศึกษาที่ได้รับมอบหมาย' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </AsyncState>
    </div>
  </div>
</template>
