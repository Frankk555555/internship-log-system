<script setup lang="ts">
import { ApiError, errorMessage } from '~/services/api'

// ต้องเข้าสู่ระบบแล้ว middleware auth พามาหน้านี้เมื่อยังใช้รหัสผ่านเริ่มต้น
definePageMeta({ layout: 'auth' })
useHead({ title: 'ตั้งรหัสผ่านใหม่' })

const route = useRoute()
const user = useSessionUser()
const { changeFirstPassword, logout } = useSession()
const notify = useNotify()
const { error: failure, clear, fail } = useFormNotice()

const currentPassword = ref('')
const password = ref('')
const confirmation = ref('')
const checked = ref(false)
const pending = ref(false)
const leaving = ref(false)
const currentFailure = ref<string>()

const currentError = computed(() => currentFailure.value
  ?? (checked.value && !currentPassword.value ? 'กรุณากรอกรหัสผ่านปัจจุบัน' : undefined))
const passwordError = computed(() => {
  if (!checked.value) return undefined
  return newPasswordError(password.value, user.value?.studentId)
    ?? (password.value === currentPassword.value ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' : undefined)
})
const confirmationError = computed(() => checked.value && confirmation.value !== password.value ? 'รหัสผ่านยืนยันไม่ตรงกัน' : undefined)

watch(currentPassword, () => {
  currentFailure.value = undefined
})

const form = useTemplateRef<HTMLFormElement>('form')

async function submit() {
  if (pending.value) return
  checked.value = true
  clear()
  if (currentError.value || passwordError.value || confirmationError.value) {
    notify('error', 'ยังตั้งรหัสผ่านไม่ได้', 'กรุณาตรวจสอบข้อมูลในช่องที่มีข้อความเตือน')
    await focusFirstInvalid(form.value)
    return
  }

  pending.value = true
  try {
    const updated = await changeFirstPassword({ currentPassword: currentPassword.value, newPassword: password.value })
    if (!updated) return
    await navigateTo(safeRedirect(route.query.redirect) ?? homePathFor(updated.role), { replace: true })
    notify('success', 'ตั้งรหัสผ่านใหม่แล้ว', 'ครั้งต่อไปให้เข้าสู่ระบบด้วยรหัสผ่านใหม่')
  }
  catch (error) {
    if (error instanceof ApiError && error.code === 'wrong_password') {
      currentFailure.value = error.message
      notify('error', 'ตั้งรหัสผ่านไม่สำเร็จ', error.message)
      await focusFirstInvalid(form.value)
    }
    else {
      fail(errorMessage(error), 'ตั้งรหัสผ่านไม่สำเร็จ')
    }
  }
  finally {
    pending.value = false
  }
}

async function signOut() {
  if (leaving.value) return
  leaving.value = true
  try {
    await logout()
    await navigateTo('/login')
    notify('success', 'ออกจากระบบแล้ว', 'เข้าสู่ระบบอีกครั้งเพื่อตั้งรหัสผ่าน')
  }
  catch {
    notify('error', 'ออกจากระบบไม่สำเร็จ', 'กรุณาลองอีกครั้ง')
  }
  finally {
    leaving.value = false
  }
}
</script>

<template>
  <div>
    <AuthHeading title="ตั้งรหัสผ่านใหม่">บัญชีนี้ยังใช้รหัสผ่านเริ่มต้น ตั้งรหัสใหม่ก่อนจึงใช้งานส่วนอื่นได้</AuthHeading>

    <form ref="form" class="space-y-5" novalidate @submit.prevent="submit">
      <!-- ช่วยให้ตัวจัดการรหัสผ่านรู้ว่าเป็นบัญชีใด -->
      <input type="email" :value="user?.email" autocomplete="username" readonly tabindex="-1" aria-hidden="true" class="sr-only">

      <TextField id="first-current" v-model="currentPassword" :label="user?.studentId ? 'รหัสผ่านปัจจุบัน (รหัสนักศึกษา)' : 'รหัสผ่านปัจจุบัน'" type="password" autocomplete="current-password" required :error="currentError" />
      <TextField id="first-new" v-model="password" :label="`รหัสผ่านใหม่ (อย่างน้อย ${minPasswordLength} ตัวอักษร)`" type="password" autocomplete="new-password" required :error="passwordError" />
      <TextField id="first-confirmation" v-model="confirmation" label="ยืนยันรหัสผ่านใหม่" type="password" autocomplete="new-password" required :error="confirmationError" />
      <p v-if="failure" class="text-2xs font-semibold text-danger" role="alert">{{ failure }}</p>
      <AuthButton label="ตั้งรหัสผ่านและเข้าใช้งาน" :pending="pending" />
    </form>

    <button type="button" :disabled="leaving || pending" class="mt-6 min-h-6 cursor-pointer text-[0.8125rem] link disabled:opacity-50" @click="signOut">
      ออกจากระบบ
    </button>
  </div>
</template>
