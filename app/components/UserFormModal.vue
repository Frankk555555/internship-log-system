<script setup lang="ts">
import type { AdminUser, UserInput } from '~/types/admin'

const props = defineProps<{
  /** ผู้ใช้ที่กำลังแก้ ไม่ระบุ = เพิ่มผู้ใช้ใหม่ */
  user?: AdminUser
  /** กำลังบันทึก */
  pending?: boolean
  /** ข้อผิดพลาดจากเซิร์ฟเวอร์ code ใช้เลือกช่องที่แสดง */
  serverError?: { message: string, code?: string }
}>()

const emit = defineEmits<{
  save: [input: UserInput]
}>()

const open = defineModel<boolean>('open', { required: true })

const blank = (): UserInput => ({ firstName: '', lastName: '', email: '', role: 'student', studentId: '' })
const input = reactive(blank())
const checked = ref(false)
const isEditing = computed(() => Boolean(props.user))
const isStudent = computed(() => input.role === 'student')

// เริ่มฟอร์มใหม่ทุกครั้งที่เปิด
watch(open, (isOpen) => {
  if (!isOpen) return
  const source = props.user
  Object.assign(input, source
    ? { firstName: source.firstName, lastName: source.lastName, email: source.email, role: source.role, studentId: source.studentId ?? '' }
    : blank())
  checked.value = false
  dismissed.value = undefined
}, { immediate: true })

// ข้อความจากเซิร์ฟเวอร์หายเมื่อผู้ใช้แก้ช่องนั้นแล้ว
const dismissed = ref<object>()
const shownServerError = computed(() => props.serverError && dismissed.value !== props.serverError ? props.serverError : undefined)
watch([() => input.email, () => input.studentId], () => {
  dismissed.value = props.serverError
})

const errors = computed(() => {
  const local = checked.value ? userInputErrors(input) : undefined
  const server = shownServerError.value
  return {
    firstName: local?.firstName,
    lastName: local?.lastName,
    email: local?.email ?? (server?.code === 'email_taken' ? server.message : undefined),
    studentId: local?.studentId ?? (server?.code === 'student_id_taken' ? server.message : undefined),
  }
})
const generalError = computed(() => {
  const server = shownServerError.value
  return server && server.code !== 'email_taken' && server.code !== 'student_id_taken' ? server.message : undefined
})

const notify = useNotify()
const form = useTemplateRef<HTMLFormElement>('form')

// เซิร์ฟเวอร์แจ้งว่าซ้ำ พาไปช่องที่ต้องแก้
watch(() => props.serverError, async (failure) => {
  if (failure) await focusFirstInvalid(form.value)
})

async function submit() {
  if (props.pending) return
  checked.value = true
  if (Object.values(userInputErrors(input)).some(Boolean)) {
    notify('error', 'ยังบันทึกไม่ได้', 'กรุณาตรวจสอบข้อมูลในช่องที่มีข้อความเตือน')
    await focusFirstInvalid(form.value)
    return
  }
  dismissed.value = undefined
  emit('save', { ...input, studentId: isStudent.value ? input.studentId : undefined })
}

const roleOptions = (['student', 'supervisor', 'admin'] as const).map(value => ({ value, label: roleLabels[value] }))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEditing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้'"
    :dismissible="!pending"
    :close="!pending"
    :ui="{
      overlay: 'bg-slate-900/10',
      content: 'max-w-lg rounded-xl bg-white ring-slate-900 divide-slate-200',
      header: 'min-h-0 px-6 py-4',
      title: 'text-lg font-bold text-ink',
      body: 'px-6 sm:px-6 py-5 sm:py-5',
      footer: 'justify-end gap-3 px-6 sm:px-6 py-4',
    }"
  >
    <template #description>
      <span class="sr-only">กรอกข้อมูลบัญชีผู้ใช้</span>
    </template>

    <template #body>
      <form id="user-form" ref="form" class="space-y-4" novalidate @submit.prevent="submit">
        <p v-if="isEditing" class="text-xs text-slate-600">บทบาท <span class="font-semibold text-ink">{{ roleLabels[input.role] }}</span> เปลี่ยนไม่ได้</p>
        <SelectField v-else id="user-role" v-model="input.role" label="บทบาท" :options="roleOptions" />

        <div class="grid gap-4 sm:grid-cols-2">
          <TextField id="user-first-name" v-model="input.firstName" label="ชื่อ" autocomplete="off" :maxlength="maxNameLength" required :error="errors.firstName" />
          <TextField id="user-last-name" v-model="input.lastName" label="นามสกุล" autocomplete="off" :maxlength="maxNameLength" required :error="errors.lastName" />
        </div>
        <TextField id="user-email" v-model="input.email" label="อีเมล" type="email" autocomplete="off" required :error="errors.email" />
        <TextField v-if="isStudent" id="user-student-id" v-model="input.studentId!" label="รหัสนักศึกษา" inputmode="numeric" autocomplete="off" maxlength="20" required :error="errors.studentId" />

        <p class="rounded-lg bg-page px-3 py-2 text-xs text-slate-600">
          <template v-if="isEditing && isStudent">บัญชีที่ยังใช้รหัสผ่านเริ่มต้น เมื่อแก้รหัสนักศึกษา รหัสผ่านจะเปลี่ยนตามรหัสใหม่</template>
          <template v-else-if="isEditing">การแก้ข้อมูลไม่เปลี่ยนรหัสผ่านของผู้ใช้</template>
          <template v-else-if="isStudent">รหัสผ่านเริ่มต้นคือรหัสนักศึกษา และต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบครั้งแรก</template>
          <template v-else>ระบบส่งลิงก์ตั้งรหัสผ่านไปที่อีเมลนี้ ผู้ใช้เข้าสู่ระบบได้หลังตั้งรหัสแล้ว</template>
        </p>

        <p v-if="generalError" class="notice-error" role="alert">{{ generalError }}</p>
      </form>
    </template>

    <template #footer>
      <button type="button" :disabled="pending" class="btn btn-secondary px-6 py-2.5 text-xs" @click="open = false">
        ยกเลิก
      </button>
      <button type="submit" form="user-form" :disabled="pending" class="btn btn-primary px-7 py-2.5 text-xs">
        {{ pending ? 'กำลังบันทึก...' : isEditing ? 'บันทึก' : 'เพิ่มผู้ใช้' }}
      </button>
    </template>
  </UModal>
</template>
