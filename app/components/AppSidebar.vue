<script setup lang="ts">
import type { UserProfile, UserRole } from '~/types/worklog'

defineProps<{
  role: UserRole
  /** ไม่มีค่าระหว่างโหลดหรือโหลดไม่สำเร็จ */
  user?: UserProfile
}>()

// จอแคบกว่า lg ใช้แถบบนกับเมนูแบบเลื่อน
const isOpen = ref(false)
const route = useRoute()

watch(() => route.fullPath, () => {
  isOpen.value = false
})

// ขยายจอจนมีเมนูข้างแล้ว ปิดเมนูแบบเลื่อน
let wideScreen: MediaQueryList | undefined

function closeOnWide(event: MediaQueryListEvent) {
  if (event.matches) isOpen.value = false
}

onMounted(() => {
  wideScreen = window.matchMedia('(min-width: 1024px)')
  wideScreen.addEventListener('change', closeOnWide)
})

onBeforeUnmount(() => wideScreen?.removeEventListener('change', closeOnWide))
</script>

<template>
  <aside class="fixed inset-y-0 left-0 z-40 hidden w-[180px] lg:block print:hidden">
    <SidebarPanel :role="role" :user="user" />
  </aside>

  <header class="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden print:hidden">
    <div>
      <p class="text-sm font-semibold">Internship Work Log System</p>
      <p class="text-xs text-slate-500">{{ workspaces[role].name }}</p>
    </div>
    <button type="button" class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" aria-label="เปิดเมนู" aria-haspopup="dialog" :aria-expanded="isOpen" @click="isOpen = true">
      <UIcon name="i-lucide-menu" class="size-5" />
    </button>
  </header>

  <USlideover v-model:open="isOpen" side="left" title="เมนู" description="เลือกหน้าที่ต้องการ" :ui="{ content: 'max-w-[240px]' }">
    <template #content>
      <SidebarPanel :role="role" :user="user" closable @close="isOpen = false" />
    </template>
  </USlideover>
</template>
