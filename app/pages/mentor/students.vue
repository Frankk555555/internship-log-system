<script setup lang="ts">
definePageMeta({ layout: 'mentor', role: 'supervisor' })
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
          <div class="grid gap-4 md:grid-cols-[1fr_1.5fr_1fr]">
            <section class="card p-4">
              <p class="text-2xs font-medium text-ink-muted">นักศึกษาที่อยู่ในความดูแล</p>
              <p class="mt-3 text-xs font-semibold text-ink"><span class="text-2xl">{{ students.length }}</span> คน</p>
            </section>

            <section class="card p-4">
              <p class="text-2xs font-medium text-ink-muted">ระยะเวลาฝึกงาน</p>
              <p v-if="period" class="mt-2 text-lg font-semibold text-ink">
                {{ formatThaiDate(period.start) }} <span class="mx-1 text-sm">ถึง</span> {{ formatThaiDate(period.end) }}
              </p>
              <p v-else class="mt-2 text-lg font-semibold text-ink-muted">–</p>
              <p v-if="period?.isMixed" class="mt-1 text-2xs text-ink-muted">ช่วงฝึกงานต่างกันรายคน ดูในตาราง</p>
            </section>

            <section class="card p-4">
              <p class="text-2xs font-medium text-ink-muted">รายการรอตรวจ</p>
              <p class="mt-3 text-xs font-semibold text-ink"><span class="text-2xl text-amber-700">{{ totals.pending }}</span> รายการ</p>
              <p class="mt-1 text-2xs" :class="totals.overdue ? 'font-semibold text-danger' : 'text-ink-muted'">ค้างตรวจเกิน {{ data.overdueDays }} วัน {{ totals.overdue }} รายการ</p>
              <NuxtLink v-if="totals.pending" to="/mentor/reviews" class="mt-1 inline-block text-2xs link">ไปตรวจงาน</NuxtLink>
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
              <table class="w-full min-w-[58.75rem] table-fixed border-collapse text-left">
                <thead>
                  <tr class="bg-page text-2xs font-semibold text-ink-muted">
                    <th class="w-[18%] px-5 py-3">นักศึกษา</th>
                    <th class="w-[11%] px-2 py-3">รหัสนักศึกษา</th>
                    <th class="px-2 py-3">ชื่อหน่วยงาน</th>
                    <th class="w-[17%] px-2 py-3">ระยะเวลาฝึกงาน</th>
                    <th class="w-[9%] px-2 py-3">ชม. อนุมัติ</th>
                    <th class="w-[16%] px-2 py-3">งานที่ส่ง</th>
                    <th class="w-[8rem] px-3 py-3"><span class="sr-only">การดำเนินการ</span></th>
                  </tr>
                </thead>
                <tbody class="text-xs text-slate-600">
                  <tr v-for="student in visibleStudents" :key="student.studentId" class="border-t border-slate-100 align-top">
                    <td class="px-5 py-3.5">
                      <p class="font-semibold text-ink">{{ student.name }}</p>
                      <a :href="`mailto:${student.email}`" class="mt-0.5 block break-all text-2xs text-ink-muted hover:text-brand">{{ student.email }}</a>
                    </td>
                    <td class="px-2 py-3.5">{{ student.studentId }}</td>
                    <td class="px-2 py-3.5">
                      {{ student.company }}
                      <span class="mt-0.5 block text-2xs text-ink-muted">{{ student.position }}</span>
                    </td>
                    <td class="px-2 py-3.5">
                      <span class="whitespace-nowrap">{{ formatThaiDate(student.startDate) }}</span>
                      ถึง <span class="whitespace-nowrap">{{ formatThaiDate(student.endDate) }}</span>
                    </td>
                    <td class="px-2 py-3.5 font-semibold text-ink">{{ formatHours(student.approvedMinutes) }}</td>
                    <td class="px-2 py-3.5">
                      <div class="flex flex-wrap gap-1.5">
                        <NuxtLink v-if="student.pendingCount" :to="{ path: '/mentor/reviews', query: { student: student.studentId } }" :aria-label="`ตรวจรายการรอตรวจของ ${student.name}`">
                          <StatusBadge :label="`รอตรวจ ${student.pendingCount}`" tone="amber" class="hover:border-amber-700" />
                        </NuxtLink>
                        <StatusBadge v-if="student.overdueCount" :label="`ค้างตรวจ ${student.overdueCount}`" tone="rose" />
                        <StatusBadge v-if="student.returnedCount" :label="`ส่งกลับแก้ไข ${student.returnedCount}`" tone="rose" />
                        <span v-if="!student.pendingCount && !student.returnedCount" class="text-2xs text-ink-muted">ไม่มีรายการค้าง</span>
                      </div>
                      <p class="mt-1.5 text-2xs text-ink-muted">
                        {{ student.lastSubmittedAt ? `ส่งล่าสุด ${submittedLabel(student.lastSubmittedAt)}` : 'ยังไม่เคยส่งตรวจ' }}
                      </p>
                    </td>
                    <td class="px-3 py-3.5">
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
