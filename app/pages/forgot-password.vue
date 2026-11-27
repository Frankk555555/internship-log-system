<script setup lang="ts">
import { errorMessage } from '~/services/api'
import type { PasswordResetTicket } from '~/types/auth'

definePageMeta({ layout: 'auth', public: true })
useHead({ title: 'ลืมรหัสผ่าน' })

const api = useApi()
const email = ref('')
const pending = ref(false)
const { error: failure, clear, fail, done } = useFormNotice()
const ticket = ref<PasswordResetTicket>()
const sentTo = ref('')
const { remaining, startUntil } = useCountdown()

async function send(address: string) {
  if (pending.value) return
  pending.value = true
  clear()
  try {
    ticket.value = await api.requestPasswordReset(address)
    sentTo.value = address
    startUntil(Date.now() + ticket.value.resendAfterSeconds * 1000)
    done('ส่งคำขอแล้ว', `ตรวจสอบอีเมล ${address} เพื่อตั้งรหัสผ่านใหม่`)
  }
  catch (error) {
    fail(errorMessage(error), 'ส่งลิงก์ไม่สำเร็จ')
  }
  finally {
    pending.value = false
  }
}

function submit() {
  if (!isEmail(email.value)) {
    fail(email.value.trim() ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'กรุณากรอกอีเมล', 'ยังส่งลิงก์ไม่ได้')
    return
  }
  send(email.value.trim())
}
</script>

<template>
  <div>
    <template v-if="!ticket">
      <AuthHeading title="ลืมรหัสผ่าน">ระบุอีเมลที่ใช้เข้าสู่ระบบเพื่อรับลิงก์ตั้งรหัสผ่านใหม่</AuthHeading>

      <form novalidate @submit.prevent="submit">
        <TextField id="forgot-email" v-model="email" label="อีเมลผู้ใช้งาน" type="email" autocomplete="username" required :error="failure" />
        <AuthButton label="ยืนยันอีเมล" :pending="pending" class="mt-5" />
      </form>
    </template>

    <template v-else>
      <AuthHeading title="ตรวจสอบอีเมลของคุณ" mark="success">
        <!-- ข้อความเดียวกันเสมอ ไม่บอกว่ามีบัญชีของอีเมลนี้หรือไม่ -->
        <p>เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ {{ maskEmail(sentTo) }} แล้ว</p>
        <p>ลิงก์มีอายุ {{ ticket.expiresInMinutes }} นาที หากไม่พบอีเมล ให้ตรวจสอบในจดหมายขยะ</p>
      </AuthHeading>

      <button
        type="button"
        :disabled="pending || remaining > 0"
        class="btn btn-primary h-10 w-full rounded-xl text-[13px]"
        @click="send(sentTo)"
      >
        {{ remaining > 0 ? `ส่งลิงก์อีกครั้ง (รอ ${remaining} วินาที)` : pending ? 'กำลังส่ง...' : 'ส่งลิงก์อีกครั้ง' }}
      </button>
      <p v-if="failure" class="mt-2 text-[11px] font-semibold text-red-600" role="alert">{{ failure }}</p>
    </template>

    <NuxtLink to="/login" class="mt-6 inline-block text-[13px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
      กลับหน้าเข้าสู่ระบบ
    </NuxtLink>
  </div>
</template>
