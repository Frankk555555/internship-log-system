<script setup lang="ts">
import { ApiError, errorMessage } from '~/services/api'

definePageMeta({ layout: 'auth', public: true })
useHead({ title: 'เข้าสู่ระบบ' })

const route = useRoute()
const { login } = useSession()
const notify = useNotify()
const { error: failure, clear, fail } = useFormNotice()

const view = ref<'form' | 'locked' | 'suspended'>('form')
const email = ref('')
const password = ref('')
const remember = ref(true)
const pending = ref(false)
const lockedUntil = ref<Date>()
const { remaining, startUntil } = useCountdown()

const unlockTime = computed(() => lockedUntil.value?.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
const remainingLabel = computed(() => `${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')}`)

/** รับเฉพาะเส้นทางภายในเว็บ กันการพาไปเว็บอื่น */
function redirectTarget() {
  const target = route.query.redirect
  return typeof target === 'string' && /^\/(?![/\\])/.test(target) ? target : undefined
}

async function submit() {
  if (pending.value) return
  if (!email.value.trim() || !password.value) {
    fail('กรุณากรอกอีเมลและรหัสผ่าน', 'เข้าสู่ระบบไม่สำเร็จ')
    return
  }
  if (!isEmail(email.value)) {
    fail('รูปแบบอีเมลไม่ถูกต้อง', 'เข้าสู่ระบบไม่สำเร็จ')
    return
  }

  pending.value = true
  clear()
  try {
    const user = await login({ email: email.value.trim(), password: password.value, remember: remember.value })
    await navigateTo(redirectTarget() ?? homePathFor(user.role))
    notify('success', 'เข้าสู่ระบบแล้ว', user.name)
  }
  catch (error) {
    if (error instanceof ApiError && error.code === 'account_locked' && error.lockedUntil) {
      lockedUntil.value = new Date(error.lockedUntil)
      startUntil(lockedUntil.value.getTime())
      password.value = ''
      view.value = 'locked'
      notify('error', 'บัญชีถูกล็อกชั่วคราว', error.message)
    }
    else if (error instanceof ApiError && error.code === 'account_suspended') {
      password.value = ''
      view.value = 'suspended'
      notify('error', 'บัญชีถูกระงับ', error.message)
    }
    else {
      fail(errorMessage(error), 'เข้าสู่ระบบไม่สำเร็จ')
    }
  }
  finally {
    pending.value = false
  }
}

function backToForm() {
  view.value = 'form'
  clear()
}
</script>

<template>
  <div>
    <template v-if="view === 'form'">
      <AuthHeading title="เข้าสู่ระบบ">กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ</AuthHeading>

      <p v-if="route.query.reset === 'done'" class="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700" role="status">
        ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ
      </p>

      <form novalidate @submit.prevent="submit">
        <div class="space-y-4">
          <TextField id="login-email" v-model="email" label="อีเมลผู้ใช้งาน" type="email" autocomplete="username" required />
          <TextField id="login-password" v-model="password" label="รหัสผ่าน" type="password" autocomplete="current-password" required />
        </div>

        <p v-if="failure" class="mt-2.5 text-[11px] font-semibold text-red-600" role="alert">{{ failure }}</p>

        <label class="mt-3 flex w-fit items-center gap-2 text-[11px] text-slate-500">
          <input v-model="remember" type="checkbox" class="size-3.5 accent-blue-600">
          จดจำการเข้าสู่ระบบ
        </label>

        <AuthButton label="เข้าสู่ระบบ (Sign In)" :pending="pending" class="mt-2.5" />
      </form>

      <NuxtLink to="/forgot-password" class="mt-4 inline-block text-[13px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
        ลืมรหัสผ่าน ?
      </NuxtLink>
    </template>

    <template v-else>
      <AuthHeading v-if="view === 'locked'" title="บัญชีถูกล็อกชั่วคราว" mark="alert">
        <p>เข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง</p>
        <p class="mt-5 font-semibold text-slate-600" role="status">
          <template v-if="remaining">ลองใหม่ได้เวลา {{ unlockTime }} น. · เหลือ {{ remainingLabel }} นาที</template>
          <template v-else>ลองเข้าสู่ระบบใหม่ได้แล้ว</template>
        </p>
      </AuthHeading>

      <AuthHeading v-else title="บัญชีถูกระงับ" mark="alert">
        <p>ติดต่อผู้ดูแลระบบเพื่อสอบถามหรือขอเปิดใช้งานบัญชี</p>
        <p class="mt-5 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-rose-700">
          <UIcon name="i-lucide-triangle-alert" class="size-4" />
          บัญชีอยู่ในสถานะระงับการใช้งาน
        </p>
      </AuthHeading>

      <button type="button" class="text-[13px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800" @click="backToForm">
        กลับหน้าเข้าสู่ระบบ
      </button>
    </template>
  </div>
</template>
