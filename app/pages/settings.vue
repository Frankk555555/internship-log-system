<script setup lang="ts">
import { ApiError, errorMessage } from '~/services/api'

// ทุกบทบาทใช้หน้านี้ได้ เลือกเมนูข้างตามบทบาท
definePageMeta({
  middleware: [() => {
    setPageLayout(useSessionUser().value?.role === 'supervisor' ? 'mentor' : 'default')
  }],
})

useHead({ title: 'ตั้งค่าบัญชี' })

const api = useApi()
const user = useSessionUser()

const currentPassword = ref('')
const password = ref('')
const confirmation = ref('')
const checked = ref(false)
const pending = ref(false)
const currentPasswordFailure = ref<string>()
const notify = useNotify()
const { error: formError, clear, fail, done } = useFormNotice()

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
  const hadInput = Boolean(currentPassword.value || password.value || confirmation.value)
  reset()
  clear()
  if (hadInput) notify('info', 'ยกเลิกแล้ว', 'ล้างข้อมูลที่กรอก รหัสผ่านยังเป็นรหัสเดิม')
}

const form = useTemplateRef<HTMLFormElement>('form')

async function save() {
  if (pending.value) return
  checked.value = true
  clear()
  if (currentError.value || passwordError.value || confirmationError.value) {
    notify('error', 'ยังเปลี่ยนรหัสผ่านไม่ได้', 'กรุณาตรวจสอบข้อมูลในช่องที่มีข้อความเตือน')
    await focusFirstInvalid(form.value)
    return
  }

  pending.value = true
  try {
    await api.changePassword({ currentPassword: currentPassword.value, newPassword: password.value })
    reset()
    done('เปลี่ยนรหัสผ่านแล้ว', 'ครั้งต่อไปให้เข้าสู่ระบบด้วยรหัสผ่านใหม่')
  }
  catch (error) {
    if (error instanceof ApiError && error.code === 'wrong_password') {
      currentPasswordFailure.value = error.message
      notify('error', 'เปลี่ยนรหัสผ่านไม่สำเร็จ', error.message)
      await focusFirstInvalid(form.value)
    }
    else {
      fail(errorMessage(error), 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    }
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      class="mb-4"
      title="ตั้งค่าบัญชี"
      description="เปลี่ยนรหัสผ่าน"
      :crumbs="[{ label: `พื้นที่${user ? roleLabels[user.role] : ''}` }, { label: 'ตั้งค่าบัญชี' }]"
    />

    <div class="grid gap-4 lg:min-h-[38rem] lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <form ref="form" class="card p-5" novalidate @submit.prevent="save">
        <h2 class="text-base font-bold text-ink">รหัสผ่านของฉัน</h2>

        <!-- ช่วยให้ตัวจัดการรหัสผ่านรู้ว่าเป็นบัญชีใด -->
        <input type="email" :value="user?.email" autocomplete="username" readonly tabindex="-1" aria-hidden="true" class="sr-only">

        <div class="mt-4 space-y-3">
          <TextField id="current-password" v-model="currentPassword" label="รหัสผ่านปัจจุบัน" type="password" autocomplete="current-password" required :error="currentError" />
          <TextField id="new-password" v-model="password" label="รหัสผ่านใหม่" type="password" autocomplete="new-password" required :error="passwordError" />
          <TextField id="confirm-password" v-model="confirmation" label="ยืนยันรหัสผ่านใหม่" type="password" autocomplete="new-password" required :error="confirmationError" />
        </div>

        <p v-if="formError" class="mt-4 notice-error">
          {{ formError }}
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

      <section class="card p-5">
        <h2 class="text-base font-bold text-ink">บัญชีที่กำลังใช้งาน</h2>
        <dl v-if="user" class="mt-4 space-y-4">
          <div>
            <dt class="text-2xs text-ink-muted">ชื่อผู้ใช้งาน</dt>
            <dd class="mt-0.5 text-sm font-semibold text-ink">{{ user.name }}</dd>
          </div>
          <div>
            <dt class="text-2xs text-ink-muted">บทบาท</dt>
            <dd class="mt-0.5 text-sm font-semibold text-ink">{{ roleLabels[user.role] }}</dd>
          </div>
          <div>
            <dt class="text-2xs text-ink-muted">อีเมล</dt>
            <dd class="mt-0.5 break-all text-sm font-semibold text-ink">{{ user.email }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>
