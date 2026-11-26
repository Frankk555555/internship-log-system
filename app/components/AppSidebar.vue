<script setup lang="ts">
import type { UserProfile, UserRole } from '~/types/worklog'

const props = defineProps<{
  user: UserProfile
}>()

const roleLabels: Record<UserRole, string> = {
  student: 'นักศึกษา',
  supervisor: 'พี่เลี้ยง',
  admin: 'แอดมิน',
}

const menus = [
  { label: 'หน้าหลัก', icon: 'i-lucide-house', to: '/', active: true },
  { label: 'บันทึกงานประจำวัน', icon: 'i-lucide-notebook-pen', to: '#' },
  { label: 'ข้อมูลสถานที่ฝึกงาน', icon: 'i-lucide-building-2', to: '#' },
  { label: 'ปฏิบัติการทำงาน', icon: 'i-lucide-clipboard-list', to: '#' },
  { label: 'รายงานรายสัปดาห์', icon: 'i-lucide-file-text', to: '#' },
  { label: 'ตั้งค่าบัญชี', icon: 'i-lucide-settings', to: '#' },
]
</script>

<template>
  <aside class="fixed inset-y-0 left-0 z-40 hidden w-[180px] flex-col overflow-hidden bg-[linear-gradient(180deg,#191642_0%,#100d31_100%)] text-white lg:flex">
    <div class="border-b border-white/10 px-4 pb-4 pt-5">
      <h1 class="text-[12px] font-semibold leading-tight">Internship Work Log System</h1>
      <p class="mt-1 text-[10px] text-slate-300">Student Workspace</p>
    </div>

    <nav class="flex-1 space-y-2 px-3 py-5">
      <NuxtLink
        v-for="item in menus"
        :key="item.label"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="item.active ? 'bg-[linear-gradient(90deg,#6548f3_0%,#4156e8_100%)] text-white shadow-lg shadow-indigo-950/20' : ''"
        :aria-current="item.active ? 'page' : undefined"
      >
        <UIcon :name="item.icon" class="size-4 shrink-0" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div class="p-3">
      <div class="rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur">
        <div class="flex items-center gap-2">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-400/70 text-xs font-semibold">
            สช
          </div>
          <div class="min-w-0">
            <p class="truncate text-[12px] font-semibold">{{ props.user.name }}</p>
            <p class="text-[10px] text-slate-300">{{ props.user.studentId }}</p>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
          <span class="text-slate-300">{{ roleLabels[props.user.role] }}</span>
          <button type="button" class="font-medium text-red-400 hover:text-red-300">ออกจากระบบ</button>
        </div>
      </div>
    </div>
  </aside>
</template>
