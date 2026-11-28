<script setup lang="ts">
import { ApiError, errorMessage } from '~/services/api'

// ทุกบทบาทใช้หน้านี้ได้ เลือกเมนูข้างตามบทบาท
definePageMeta({
  middleware: [() => {
    setPageLayout(layoutFor(useSessionUser().value?.role))
  }],
})

useHead({ title: 'ตั้งค่าบัญชี' })

const user = useSessionUser()
const { updateProfile, changePassword } = useSession()
// โหลดผู้ใช้ไม่ได้ตอนเปิดหน้า จึงไม่มีข้อมูลบัญชีให้แก้ อ่านครั้งเดียว ตอนออกจากระบบจะได้ไม่กระพริบ
const accountError = user.value ? undefined : { message: 'โหลดข้อมูลบัญชีไม่ได้ กรุณาลองใหม่' }

const firstName = ref(user.value?.firstName ?? '')
const lastName = ref(user.value?.lastName ?? '')
const nameChecked = ref(false)
const savingName = ref(false)
const { error: nameFormError, clear: clearName, fail: failName, done: nameDone } = useFormNotice()

const firstNameError = computed(() => nameChecked.value ? nameError(firstName.value, 'ชื่อ') : undefined)
const lastNameError = computed(() => nameChecked.value ? nameError(lastName.value, 'นามสกุล') : undefined)
const nameChanged = computed(() => firstName.value.trim() !== user.value?.firstName || lastName.value.trim() !== user.value?.lastName)

function resetName() {
  firstName.value = user.value?.firstName ?? ''
  lastName.value = user.value?.lastName ?? ''
  nameChecked.value = false
}

function cancelName() {
  const hadChange = nameChanged.value
  resetName()
  clearName()
  if (hadChange) notify('info', 'ยกเลิกแล้ว', 'คืนค่าชื่อและนามสกุลเดิม')
}

const nameForm = useTemplateRef<HTMLFormElement>('nameForm')

async function saveName() {
  if (savingName.value) return
  nameChecked.value = true
  clearName()
  if (firstNameError.value || lastNameError.value) {
    notify('error', 'ยังบันทึกชื่อไม่ได้', 'กรุณาตรวจสอบข้อมูลในช่องที่มีข้อความเตือน')
    await focusFirstInvalid(nameForm.value)
    return
  }
  if (!nameChanged.value) {
    resetName()
    notify('info', 'ไม่มีการเปลี่ยนแปลง', 'ชื่อและนามสกุลยังเหมือนเดิม')
    return
  }

  savingName.value = true
  try {
    await updateProfile({ firstName: firstName.value.trim(), lastName: lastName.value.trim() })
    resetName()
    nameDone('บันทึกชื่อแล้ว', user.value?.name ?? '')
  }
  catch (error) {
    failName(errorMessage(error), 'บันทึกชื่อไม่สำเร็จ')
  }
  finally {
    savingName.value = false
  }
}

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
  return newPasswordError(password.value, user.value?.studentId)
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
    if (!await changePassword({ currentPassword: currentPassword.value, newPassword: password.value })) return
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
      description="แก้ไขชื่อและเปลี่ยนรหัสผ่าน"
      :crumbs="[{ label: `พื้นที่${user ? roleLabels[user.role] : ''}` }, { label: 'ตั้งค่าบัญชี' }]"
    />

    <AsyncState :loading="false" :error="accountError">
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div class="space-y-4">
          <form ref="nameForm" class="card p-5" novalidate @submit.prevent="saveName">
            <h2 class="text-base font-bold text-ink">ชื่อและนามสกุล</h2>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <TextField id="first-name" v-model="firstName" label="ชื่อ" autocomplete="given-name" :maxlength="maxNameLength" required :error="firstNameError" />
              <TextField id="last-name" v-model="lastName" label="นามสกุล" autocomplete="family-name" :maxlength="maxNameLength" required :error="lastNameError" />
            </div>

            <p v-if="nameFormError" class="mt-4 notice-error">
              {{ nameFormError }}
            </p>

            <div class="mt-5 flex gap-3">
              <button type="submit" :disabled="savingName" class="btn btn-primary px-7 py-2.5 text-xs">
                {{ savingName ? 'กำลังบันทึก...' : 'บันทึกชื่อ' }}
              </button>
              <button type="button" :disabled="savingName" class="btn btn-secondary px-7 py-2.5 text-xs" @click="cancelName">
                ยกเลิก
              </button>
            </div>
          </form>

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
        </div>

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
    </AsyncState>
  </div>
</template>
