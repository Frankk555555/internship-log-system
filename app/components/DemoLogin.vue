<script setup lang="ts">
import type { UserRole } from '~/types/worklog'

defineProps<{
  /** ปิดปุ่มระหว่างกำลังเข้าสู่ระบบ */
  disabled?: boolean
}>()

defineEmits<{
  select: [credentials: { email: string, password: string }]
}>()

const accounts = useDemoAccounts()
const icons: Record<UserRole, string> = {
  student: 'i-lucide-graduation-cap',
  supervisor: 'i-lucide-user-check',
  admin: 'i-lucide-shield',
}
</script>

<template>
  <section v-if="accounts.length" class="mt-6 border-t border-line pt-5" aria-labelledby="demo-login-title">
    <h3 id="demo-login-title" class="text-[0.8125rem] font-semibold text-slate-700">บัญชีทดสอบ</h3>
    <p class="mt-0.5 text-2xs text-ink-muted">กดเพื่อเข้าสู่ระบบด้วยข้อมูลจำลอง</p>

    <div class="mt-3 grid gap-2 sm:grid-cols-2">
      <button
        v-for="account in accounts"
        :key="account.email"
        type="button"
        :disabled="disabled"
        class="btn btn-secondary flex-col items-start gap-0.5 px-3.5 py-2.5 text-left"
        @click="$emit('select', { email: account.email, password: account.password })"
      >
        <span class="flex items-center gap-1.5 text-xs">
          <UIcon :name="icons[account.role]" class="size-4 shrink-0" />
          เข้าในฐานะ{{ roleLabels[account.role] }}
        </span>
        <span class="text-2xs font-medium text-ink-muted">{{ account.name }}</span>
      </button>
    </div>
  </section>
</template>
