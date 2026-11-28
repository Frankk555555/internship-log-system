<script setup lang="ts">
import type { MentorAbsence } from '~/types/admin'

definePageMeta({ layout: 'staff', role: 'admin' })
useHead({ title: 'ภาพรวมระบบ' })

/** ช่วงไม่อยู่ที่แสดงบนหน้านี้ ที่เหลือดูในหน้าพี่เลี้ยงไม่อยู่ */
const absenceLimit = 4

const api = useApi()
const { data, status, error, refresh } = await useLazyAsyncData('admin-overview', () => api.getOverview())

const description = computed(() => [data.value?.semester, 'สิ่งที่ต้องจัดการเรียงตามความเร่งด่วน'].filter(Boolean).join(' '))

const stats = computed(() => {
  const overview = data.value
  if (!overview) return []
  return [
    { label: 'นักศึกษาฝึกงาน', value: overview.studentCount, unit: 'คน', tone: 'text-ink' },
    { label: 'พี่เลี้ยง', value: overview.supervisorCount, unit: 'คน', tone: 'text-ink' },
    { label: 'รอตรวจทั้งระบบ', value: overview.pendingCount, unit: 'รายการ', tone: 'text-amber-700' },
    { label: `ค้างตรวจเกิน ${overview.overdueDays} วัน`, value: overview.overdueCount, unit: 'รายการ', tone: 'text-rose-700' },
  ]
})

function rangeLabel({ startAt, endAt }: MentorAbsence) {
  const start = toThaiTimeParts(startAt)
  const end = toThaiTimeParts(endAt)
  return `${formatThaiDate(start.date)} ${start.time} – ${start.date === end.date ? '' : `${formatThaiDate(end.date)} `}${end.time} น.`
}
</script>

<template>
  <div>
    <PageHeader title="ภาพรวมระบบ" :description="description" :crumbs="[{ label: 'พื้นที่แอดมิน' }, { label: 'ภาพรวม' }]">
      <template #actions>
        <NotificationButton />
      </template>
    </PageHeader>

    <div class="mt-4">
      <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
        <template v-if="data">
          <dl class="card grid grid-cols-2 gap-y-4 py-4 md:grid-cols-4">
            <div v-for="stat in stats" :key="stat.label" class="border-line px-5 even:border-l md:border-l md:first:border-l-0">
              <dt class="text-2xs text-ink-muted">{{ stat.label }}</dt>
              <dd class="mt-1 flex items-baseline gap-1.5">
                <span class="text-3xl font-bold leading-none tabular-nums" :class="stat.tone">{{ stat.value }}</span>
                <span class="text-xs text-slate-600">{{ stat.unit }}</span>
              </dd>
            </div>
          </dl>

          <div class="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section class="card overflow-hidden" aria-labelledby="tasks-title">
              <div class="flex items-center justify-between gap-3 px-5 py-4">
                <h2 id="tasks-title" class="text-base font-bold text-ink">งานที่ต้องจัดการ</h2>
                <StatusBadge v-if="data.tasks.length" :label="`${data.tasks.length} เรื่อง`" tone="slate" />
              </div>
              <AdminTaskList v-if="data.tasks.length" :tasks="data.tasks" :overdue-days="data.overdueDays" :max-failed-logins="data.maxFailedLogins" />
              <p v-else class="border-t border-line px-5 py-12 text-center text-sm text-ink-muted">ไม่มีเรื่องที่ต้องจัดการ</p>
            </section>

            <div class="grid gap-4">
              <section class="card px-5 py-4" aria-labelledby="absences-title">
                <div class="flex items-center justify-between gap-3">
                  <h2 id="absences-title" class="text-base font-bold text-ink">พี่เลี้ยงไม่อยู่ช่วงนี้</h2>
                  <NuxtLink :to="{ path: '/admin/mentor-absences', query: { from: 'overview' } }" class="link inline-flex min-h-8 items-center text-xs">ดูทั้งหมด</NuxtLink>
                </div>
                <ul v-if="data.absences.length" class="mt-2">
                  <li v-for="absence in data.absences.slice(0, absenceLimit)" :key="absence.id" class="border-t border-line py-3 last:pb-0">
                    <div class="flex items-start justify-between gap-3">
                      <p class="min-w-0 break-words text-sm font-semibold text-ink">{{ absence.mentorName }}</p>
                      <StatusBadge :label="absence.status === 'now' ? 'ไม่อยู่ตอนนี้' : 'กำหนดไว้'" :tone="absence.status === 'now' ? 'amber' : 'blue'" />
                    </div>
                    <p class="mt-1 text-2xs tabular-nums text-slate-600">{{ rangeLabel(absence) }}</p>
                  </li>
                </ul>
                <p v-else class="mt-2 border-t border-line py-8 text-center text-xs text-ink-muted">ไม่มีช่วงที่พี่เลี้ยงไม่อยู่</p>
                <p v-if="data.absences.length > absenceLimit" class="mt-3 text-2xs text-ink-muted">และอีก {{ data.absences.length - absenceLimit }} ช่วง</p>
              </section>

              <LastImportCard :summary="data.lastImport" />
            </div>
          </div>
        </template>
      </AsyncState>
    </div>
  </div>
</template>
