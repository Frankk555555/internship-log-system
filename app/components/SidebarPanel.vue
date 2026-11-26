<script setup lang="ts">
import type { UserProfile, UserRole } from '~/types/worklog'

const props = defineProps<{
  role: UserRole
  /** ไม่มีค่าระหว่างโหลดหรือโหลดไม่สำเร็จ */
  user?: UserProfile
  /** แสดงปุ่มปิด ใช้ตอนเป็นเมนูแบบเลื่อนบนจอแคบ */
  closable?: boolean
}>()

defineEmits<{
  /** กดปิด หรือเลือกเมนูแล้ว */
  close: []
}>()

const workspace = computed(() => workspaces[props.role])

const { logout } = useSession()
const isLoggingOut = ref(false)
const logoutFailed = ref(false)

async function onLogout() {
  isLoggingOut.value = true
  logoutFailed.value = false
  try {
    await logout()
    await navigateTo('/login')
  }
  catch {
    logoutFailed.value = true
  }
  finally {
    isLoggingOut.value = false
  }
}

const route = useRoute()

// หน้าย่อย เช่น /worklogs/new ให้ไฮไลต์เมนูแม่ด้วย
function isActive(to: string) {
  return route.path === to || (to !== '/' && route.path.startsWith(`${to}/`))
}
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto bg-[linear-gradient(180deg,#191642_0%,#100d31_100%)] text-white">
    <div class="flex items-start justify-between gap-2 border-b border-white/10 px-4 pb-4 pt-5">
      <div>
        <h1 class="text-[12px] font-semibold leading-tight">Internship Work Log System</h1>
        <p class="mt-1 text-[10px] text-slate-300">{{ workspace.name }}</p>
      </div>
      <button v-if="closable" type="button" class="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10" aria-label="ปิดเมนู" @click="$emit('close')">
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>

    <nav class="flex-1 space-y-2 px-3 py-5" aria-label="เมนูหลัก">
      <NuxtLink
        v-for="item in workspace.menus"
        :key="item.label"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="isActive(item.to) ? 'bg-[linear-gradient(90deg,#6548f3_0%,#4156e8_100%)] text-white shadow-lg shadow-indigo-950/20' : ''"
        :aria-current="isActive(item.to) ? 'page' : undefined"
        @click="$emit('close')"
      >
        <UIcon :name="item.icon" class="size-4 shrink-0" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div class="p-2.5">
      <div class="rounded-xl border border-white/10 bg-white/10 p-2.5 backdrop-blur">
        <div class="flex items-center gap-2">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-400/70 text-xs font-semibold">
            {{ props.user?.initials }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-[12px] font-semibold">{{ props.user?.name ?? '...' }}</p>
            <p v-if="props.user?.studentId" class="text-[10px] text-slate-300">{{ props.user.studentId }}</p>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between gap-1 whitespace-nowrap border-t border-white/10 pt-2 text-[9.5px]">
          <span class="text-slate-300">บทบาท: {{ workspace.roleLabel }}</span>
          <button type="button" :disabled="isLoggingOut" class="font-medium text-red-400 hover:text-red-300 disabled:opacity-50" @click="onLogout">ออกจากระบบ</button>
        </div>
        <p v-if="logoutFailed" class="mt-1 text-[9.5px] text-red-300" role="alert">ออกจากระบบไม่สำเร็จ ลองอีกครั้ง</p>
      </div>
    </div>
  </div>
</template>
