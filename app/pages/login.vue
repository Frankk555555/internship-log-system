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

/** ย้ายโฟกัสไปช่องที่ต้องแก้ */
function focusField(id: 'login-email' | 'login-password') {
  document.getElementById(id)?.focus()
}

async function submit() {
  if (pending.value) return
  if (!email.value.trim() || !password.value) {
    fail('กรุณากรอกอีเมลและรหัสผ่าน', 'เข้าสู่ระบบไม่สำเร็จ')
    focusField(email.value.trim() ? 'login-password' : 'login-email')
    return
  }
  if (!isEmail(email.value)) {
    fail('รูปแบบอีเมลไม่ถูกต้อง', 'เข้าสู่ระบบไม่สำเร็จ')
    focusField('login-email')
    return
  }

  await signIn({ email: email.value.trim(), password: password.value }, safeRedirect(route.query.redirect))
}

/** บัญชีทดสอบไปหน้าหลักของบทบาทนั้นเสมอ เพราะหน้าที่ค้างอยู่อาจเป็นของบทบาทอื่น */
function signInDemo(credentials: { email: string, password: string }) {
  if (!pending.value) signIn(credentials)
}

function showLocked(until: string, message: string) {
  lockedUntil.value = new Date(until)
  startUntil(lockedUntil.value.getTime())
  password.value = ''
  view.value = 'locked'
  notify('error', 'บัญชีถูกล็อกชั่วคราว', message)
}

// ถูกล็อกระหว่างเปลี่ยนรหัสผ่านแล้วถูกพามาหน้านี้
const lockNotice = useLockNotice()
onMounted(() => {
  if (!lockNotice.value) return
  showLocked(lockNotice.value, 'กรอกรหัสผ่านปัจจุบันผิดครบจำนวนครั้ง ระบบจึงออกจากระบบให้')
  lockNotice.value = undefined
})

async function signIn(credentials: { email: string, password: string }, destination?: string) {
  pending.value = true
  clear()
  try {
    const user = await login({ ...credentials, remember: remember.value })
    await navigateTo(destination ?? homePathFor(user.role))
    notify('success', 'เข้าสู่ระบบแล้ว', user.name)
  }
  catch (error) {
    if (error instanceof ApiError && error.code === 'account_locked' && error.lockedUntil) {
      showLocked(error.lockedUntil, error.message)
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

        <p v-if="failure" class="mt-2.5 text-2xs font-semibold text-danger" role="alert">{{ failure }}</p>

        <label class="mt-3 flex w-fit items-center gap-2 text-2xs text-ink-muted">
          <input v-model="remember" type="checkbox" class="size-3.5 accent-brand">
          จดจำการเข้าสู่ระบบ
        </label>

        <AuthButton label="เข้าสู่ระบบ" :pending="pending" class="mt-2.5" />
      </form>

      <NuxtLink to="/forgot-password" class="mt-4 inline-block text-[0.8125rem] link">
        ลืมรหัสผ่าน ?
      </NuxtLink>

      <DemoLogin :disabled="pending" @select="signInDemo" />
    </template>

    <template v-else>
      <AuthHeading v-if="view === 'locked'" title="บัญชีถูกล็อกชั่วคราว" mark="alert">
        <p>กรอกรหัสผ่านผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง</p>
        <p class="mt-5 font-semibold text-slate-600" role="status">
          <template v-if="remaining">ลองใหม่ได้เวลา {{ unlockTime }} น. · เหลือ {{ remainingLabel }} นาที</template>
          <template v-else>ลองเข้าสู่ระบบใหม่ได้แล้ว</template>
        </p>
      </AuthHeading>

      <AuthHeading v-else title="บัญชีถูกระงับ" mark="alert">
        <p>ติดต่อผู้ดูแลระบบเพื่อสอบถามหรือขอเปิดใช้งานบัญชี</p>
        <p class="mt-5 flex items-center justify-center gap-1.5 text-[0.8125rem] font-semibold text-rose-700">
          <UIcon name="i-lucide-triangle-alert" class="size-4" />
          บัญชีอยู่ในสถานะระงับการใช้งาน
        </p>
      </AuthHeading>

      <button type="button" class="text-[0.8125rem] link" @click="backToForm">
        กลับหน้าเข้าสู่ระบบ
      </button>
    </template>
  </div>
</template>
