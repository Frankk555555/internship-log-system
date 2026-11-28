<script setup lang="ts">
import type { AdminTask } from '~/types/admin'

const props = defineProps<{
  tasks: AdminTask[]
  overdueDays: number
  maxFailedLogins: number
}>()

/** แสดงชื่อไม่เกินสองคน ที่เหลือบอกเป็นจำนวน */
function names(list: string[]) {
  return list.length <= 2 ? list.join(' และ ') : `${list.slice(0, 2).join(', ')} และอีก ${list.length - 2} คน`
}

function dateTimeLabel(value: string) {
  const { date, time } = toThaiTimeParts(value)
  return `${formatThaiDate(date)} • ${time} น.`
}

function describe(task: AdminTask) {
  switch (task.kind) {
    case 'absent_mentor': {
      const overdue = task.overdueCount ? ` ค้างเกิน ${props.overdueDays} วัน ${task.overdueCount} รายการ` : ''
      return {
        key: `absent-${task.mentorId}`,
        icon: 'i-lucide-triangle-alert',
        tone: 'bg-rose-100 text-rose-700',
        title: 'พี่เลี้ยงไม่อยู่ และมีงานรอตรวจ',
        detail: `${task.mentorName} ไม่อยู่ถึง ${dateTimeLabel(task.endAt)} นักศึกษารอตรวจ ${task.pendingCount} รายการ${overdue}`,
        action: 'อนุมัติแทน',
        to: { path: '/admin/proxy-reviews', query: { mentor: task.mentorId } },
        urgent: true,
      }
    }
    case 'no_mentor':
      return {
        key: task.kind,
        icon: 'i-lucide-users',
        tone: 'bg-amber-100 text-amber-700',
        title: `นักศึกษายังไม่มีพี่เลี้ยง ${task.students.length} คน`,
        detail: `${names(task.students.map(student => student.name))} ยังบันทึกและส่งตรวจไม่ได้`,
        action: 'กำหนดพี่เลี้ยง',
        to: { path: '/admin/internships', query: { filter: 'no_mentor' } },
        urgent: false,
      }
    case 'no_hours': {
      const [first] = task.students
      // คนเดียวบอกสถานประกอบการด้วย
      const who = task.students.length === 1 && first?.company ? `${first.name} ${first.company}` : names(task.students.map(student => student.name))
      return {
        key: task.kind,
        icon: 'i-lucide-clock',
        tone: 'bg-amber-100 text-amber-700',
        title: `ข้อมูลการฝึกงานยังไม่มีเวลางาน ${task.students.length} รายการ`,
        detail: `${who} ใช้หน้าบันทึกงานไม่ได้จนกว่าจะกรอก`,
        action: 'กรอกเวลางาน',
        to: { path: '/admin/internships', query: { filter: 'no_hours' } },
        urgent: false,
      }
    }
    case 'locked': {
      const [first] = task.accounts
      return {
        key: task.kind,
        icon: 'i-lucide-lock',
        tone: 'bg-slate-100 text-slate-600',
        title: `บัญชีถูกล็อกชั่วคราว ${task.accounts.length} บัญชี`,
        detail: task.accounts.length === 1 && first
          ? `${first.email} กรอกรหัสผ่านผิด ${props.maxFailedLogins} ครั้ง ปลดล็อกเองเวลา ${toThaiTimeParts(first.lockedUntil).time} น.`
          : `${task.accounts.map(account => account.email).join(', ')} ปลดล็อกเองเมื่อครบเวลา`,
        action: 'ดูบัญชี',
        to: { path: '/admin/users', query: { status: 'locked' } },
        urgent: false,
      }
    }
  }
}

const rows = computed(() => props.tasks.map(describe))
</script>

<template>
  <ul>
    <li v-for="row in rows" :key="row.key" class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-5 py-3.5">
      <span class="flex size-9 shrink-0 items-center justify-center self-start rounded-full sm:self-center" :class="row.tone" aria-hidden="true">
        <UIcon :name="row.icon" class="size-4" />
      </span>
      <div class="min-w-0 flex-1 basis-48">
        <h3 class="text-sm font-bold leading-snug text-ink">{{ row.title }}</h3>
        <p class="mt-0.5 break-words text-2xs tabular-nums text-slate-600">{{ row.detail }}</p>
      </div>
      <NuxtLink
        :to="row.to"
        class="btn ml-auto min-h-10 px-4 text-xs"
        :class="row.urgent ? 'btn-primary' : 'btn-secondary'"
        :aria-label="`${row.action}: ${row.title}`"
      >
        {{ row.action }}
      </NuxtLink>
    </li>
  </ul>
</template>
