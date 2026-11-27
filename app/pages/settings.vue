<script setup lang="ts">
import { ApiError, errorMessage } from '~/services/api'

// ทุกบทบาทใช้หน้านี้ได้ เลือกเมนูข้างตามบทบาท
definePageMeta({
  middleware: [() => {
    setPageLayout(useSessionUser().value?.role === 'supervisor' ? 'mentor' : 'default')
  }],
})

const api = useApi()
const user = useSessionUser()

const currentPassword = ref('')
const password = ref('')
const confirmation = ref('')
const checked = ref(false)
const pending = ref(false)
const currentPasswordFailure = ref<string>()
const notice = ref<{ tone: 'error' | 'success', text: string }>()

const currentError = computed(() => currentPasswordFailure.value
  ?? (checked.value && !currentPassword.value ? 'กรุณากรอกรหัสผ่านปัจจุบัน' : undefined))
const passwordError = computed(() => {
  if (!checked.value) return undefined
  return newPasswordError(password.value)
    ?? (password.value === currentPassword.value ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' : undefined)
})
const confirmationError = computed(() => checked.value && confirmation.value !== password.value ? 'รหัสผ่านยืนยันไม่ตรงกัน' : undefined)

watch(currentPassword, () => {
  currentPasswordFailure.value = undefined
})

function reset() {
  currentPassword.value = ''
  password.value = ''
  confirmation.value = ''
  checked.value = false
  currentPasswordFailure.value = undefined
}

function cancel() {
  reset()
  notice.value = undefined
}

async function save() {
  if (pending.value) return
  checked.value = true
  notice.value = undefined
  if (currentError.value || passwordError.value || confirmationError.value) return

  pending.value = true
  try {
    await api.changePassword({ currentPassword: currentPassword.value, newPassword: password.value })
    reset()
    notice.value = { tone: 'success', text: 'เปลี่ยนรหัสผ่านแล้ว' }
  }
  catch (error) {
    if (error instanceof ApiError && error.code === 'wrong_password') currentPasswordFailure.value = error.message
    else notice.value = { tone: 'error', text: errorMessage(error) }
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <header class="mb-4 border-b border-slate-200 pb-5">
      <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-500" aria-label="breadcrumb">
        <span>พื้นที่{{ user ? roleLabels[user.role] : '' }}</span>
        <span>/</span>
        <span class="text-slate-500">ตั้งค่าบัญชี</span>
      </nav>
      <h2 class="mt-2 text-2xl font-bold text-slate-900">ตั้งค่าบัญชี</h2>
      <p class="mt-1 text-xs text-slate-500">เปลี่ยนรหัสผ่าน</p>
    </header>

    <div class="grid gap-4 lg:min-h-[38rem] lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <form class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" novalidate @submit.prevent="save">
        <h3 class="text-base font-bold text-slate-900">รหัสผ่านของฉัน</h3>

        <!-- ช่วยให้ตัวจัดการรหัสผ่านรู้ว่าเป็นบัญชีใด -->
        <input type="email" :value="user?.email" autocomplete="username" readonly tabindex="-1" aria-hidden="true" class="sr-only">

        <div class="mt-4 space-y-3">
          <TextField id="current-password" v-model="currentPassword" label="รหัสผ่านปัจจุบัน" type="password" autocomplete="current-password" required :error="currentError" />
          <TextField id="new-password" v-model="password" label="รหัสผ่านใหม่" type="password" autocomplete="new-password" required :error="passwordError" />
          <TextField id="confirm-password" v-model="confirmation" label="ยืนยันรหัสผ่านใหม่" type="password" autocomplete="new-password" required :error="confirmationError" />
        </div>

        <p
          v-if="notice"
          class="mt-4 rounded-lg px-3 py-2 text-[11px] font-medium"
          :class="notice.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'"
          role="status"
        >
          {{ notice.text }}
        </p>

        <div class="mt-5 flex gap-3">
          <button type="submit" :disabled="pending" class="btn btn-primary px-7 py-2.5 text-xs">
            {{ pending ? 'กำลังบันทึก...' : 'บันทึก' }}
          </button>
          <button type="button" :disabled="pending" class="btn btn-secondary px-7 py-2.5 text-xs" @click="cancel">
            ยกเลิก
          </button>
        </div>
      </form>

      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 class="text-base font-bold text-slate-900">บัญชีที่กำลังใช้งาน</h3>
        <dl v-if="user" class="mt-4 space-y-4">
          <div>
            <dt class="text-[11px] text-slate-500">ชื่อผู้ใช้งาน</dt>
            <dd class="mt-0.5 text-sm font-semibold text-slate-900">{{ user.name }}</dd>
          </div>
          <div>
            <dt class="text-[11px] text-slate-500">บทบาท</dt>
            <dd class="mt-0.5 text-sm font-semibold text-slate-900">{{ roleLabels[user.role] }}</dd>
          </div>
          <div>
            <dt class="text-[11px] text-slate-500">อีเมล</dt>
            <dd class="mt-0.5 break-all text-sm font-semibold text-slate-900">{{ user.email }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>
