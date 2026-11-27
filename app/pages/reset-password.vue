<script setup lang="ts">
import { ApiError, errorMessage } from '~/services/api'

// key: เปิดลิงก์ใหม่ขณะอยู่หน้านี้ ต้องเริ่มฟอร์มใหม่ด้วย token ใหม่
definePageMeta({ layout: 'auth', public: true, key: route => route.fullPath })
// ไม่ส่ง token ในลิงก์ต่อไปยังเว็บอื่นผ่าน Referer
useHead({ title: 'ตั้งรหัสผ่านใหม่', meta: [{ name: 'referrer', content: 'no-referrer' }] })

const route = useRoute()
const api = useApi()
const token = typeof route.query.token === 'string' ? route.query.token : ''

const password = ref('')
const confirmation = ref('')
const checked = ref(false)
const pending = ref(false)
const failure = ref<string>()
const isInvalidLink = ref(!token)

const passwordError = computed(() => checked.value ? newPasswordError(password.value) : undefined)
const confirmationError = computed(() => checked.value && confirmation.value !== password.value ? 'รหัสผ่านยืนยันไม่ตรงกัน' : undefined)

async function submit() {
  if (pending.value) return
  checked.value = true
  failure.value = undefined
  if (passwordError.value || confirmationError.value) return

  pending.value = true
  try {
    await api.resetPassword(token, password.value)
    await navigateTo({ path: '/login', query: { reset: 'done' } }, { replace: true })
  }
  catch (error) {
    if (error instanceof ApiError && error.code === 'invalid_token') isInvalidLink.value = true
    else failure.value = errorMessage(error)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="isInvalidLink">
      <AuthHeading title="ลิงก์ใช้ไม่ได้" mark="alert">ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่</AuthHeading>
      <NuxtLink to="/forgot-password" class="mr-5 inline-block text-[13px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
        ขอลิงก์ใหม่
      </NuxtLink>
    </template>

    <template v-else>
      <AuthHeading title="ตั้งรหัสผ่านใหม่">ตั้งรหัสผ่านสำหรับการเข้าสู่ระบบครั้งถัดไป</AuthHeading>

      <form class="space-y-5" novalidate @submit.prevent="submit">
        <TextField id="reset-password" v-model="password" label="รหัสผ่านใหม่" type="password" autocomplete="new-password" required :error="passwordError" />
        <TextField id="reset-confirmation" v-model="confirmation" label="ยืนยันรหัสผ่านใหม่" type="password" autocomplete="new-password" required :error="confirmationError" />
        <p v-if="failure" class="text-[11px] font-semibold text-red-600" role="alert">{{ failure }}</p>
        <AuthButton label="ยืนยันรหัสผ่าน" :pending="pending" />
      </form>
    </template>

    <NuxtLink to="/login" class="mt-6 inline-block text-[13px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
      กลับหน้าเข้าสู่ระบบ
    </NuxtLink>
  </div>
</template>
