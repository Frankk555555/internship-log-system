<script setup lang="ts">
import { errorMessage } from '~/services/api'

definePageMeta({ layout: 'staff', role: 'admin' })
useHead({ title: 'ตั้งค่าระบบ' })

const api = useApi()
const { data, status, error, refresh } = await useLazyAsyncData('system-settings', () => api.getSystemSettings())

const backdate = ref('')
const overdue = ref('')
const checked = ref(false)
const pending = ref(false)
const notify = useNotify()
const { error: formError, clear, fail, done } = useFormNotice()

const backdateError = computed(() => checked.value ? settingDayError(backdate.value) : undefined)
const overdueError = computed(() => checked.value ? settingDayError(overdue.value) : undefined)
const changed = computed(() => Boolean(data.value)
  && (backdate.value.trim() !== String(data.value!.backdateLimitDays) || overdue.value.trim() !== String(data.value!.reviewOverdueDays)))

function reset() {
  backdate.value = data.value ? String(data.value.backdateLimitDays) : ''
  overdue.value = data.value ? String(data.value.reviewOverdueDays) : ''
  checked.value = false
}

// ข้อมูลมาถึงหรือถูกบันทึกแล้ว ช่องกรอกแสดงค่าล่าสุด
watch(data, reset, { immediate: true })

function cancel() {
  const hadChange = changed.value
  reset()
  clear()
  if (hadChange) notify('info', 'ยกเลิกแล้ว', 'คืนค่าเดิม ยังไม่ได้บันทึกอะไร')
}

const lastEdit = computed(() => {
  if (!data.value?.updatedAt) return 'ยังไม่เคยแก้ไข'
  const { date, time } = toThaiTimeParts(data.value.updatedAt)
  return `แก้ไขล่าสุด ${formatThaiDate(date)} • ${time} น.${data.value.updatedBy ? ` โดย ${data.value.updatedBy}` : ''}`
})

const form = useTemplateRef<HTMLFormElement>('form')

async function save() {
  if (pending.value) return
  checked.value = true
  clear()
  if (backdateError.value || overdueError.value) {
    notify('error', 'ยังบันทึกไม่ได้', 'กรุณาตรวจสอบข้อมูลในช่องที่มีข้อความเตือน')
    await focusFirstInvalid(form.value)
    return
  }
  if (!changed.value) {
    reset()
    notify('info', 'ไม่มีการเปลี่ยนแปลง', 'ค่าทั้งหมดยังเหมือนเดิม')
    return
  }

  pending.value = true
  try {
    data.value = await api.saveSystemSettings({ backdateLimitDays: Number(backdate.value), reviewOverdueDays: Number(overdue.value) })
    done('บันทึกการตั้งค่าแล้ว', `บันทึกย้อนหลัง ${data.value.backdateLimitDays} วัน ค้างตรวจเมื่อรอเกิน ${data.value.reviewOverdueDays} วัน`)
  }
  catch (problem) {
    fail(errorMessage(problem), 'บันทึกการตั้งค่าไม่สำเร็จ')
  }
  finally {
    pending.value = false
  }
}

const effects = [
  { title: 'ทันทีหลังบันทึก', detail: 'วันที่ที่เลือกได้ในฟอร์มบันทึกย้อนหลัง และการนับค้างตรวจเปลี่ยนตามค่าใหม่' },
  { title: 'รายการที่ส่งแล้วไม่เปลี่ยน', detail: 'สถานะตรวจและชั่วโมงที่อนุมัติแล้วคงเดิม' },
  { title: 'ทุกคนเห็นค่าเดียวกัน', detail: 'ยังตั้งแยกตามหน่วยงานไม่ได้' },
]
</script>

<template>
  <div>
    <PageHeader
      title="ตั้งค่าระบบ"
      description="กติกาที่ใช้กับนักศึกษาและพี่เลี้ยงทุกคน"
      :crumbs="[{ label: 'พื้นที่แอดมิน' }, { label: 'ตั้งค่าระบบ' }]"
    />

    <div class="mt-4">
      <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
        <div v-if="data" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
          <form ref="form" class="card px-5 pt-5" novalidate @submit.prevent="save">
            <h2 class="pb-3 text-base font-bold text-ink">กติกาการบันทึกและตรวจงาน</h2>

            <SettingRow
              id="backdate-days"
              v-model="backdate"
              label="บันทึกย้อนหลังได้ไม่เกิน"
              hint="นับวันตามปฏิทิน ใช้กับฟอร์มบันทึกย้อนหลัง การแก้ฉบับร่าง และรายการที่ถูกส่งกลับ"
              unit="วัน"
              :error="backdateError"
            />
            <SettingRow
              id="overdue-days"
              v-model="overdue"
              label="ถือว่าค้างตรวจเมื่อรอเกิน"
              hint="พี่เลี้ยงได้รับแจ้งเตือนค้างตรวจ และรายการขึ้นป้ายค้างตรวจ"
              unit="วัน"
              :error="overdueError"
            />
            <SettingRow
              id="max-failed-logins"
              :model-value="String(data.maxFailedLogins)"
              label="ล็อกบัญชีเมื่อกรอกรหัสผ่านผิด"
              hint="กำหนดตามขอบเขตงานข้อ 1.2 แก้ที่หน้านี้ไม่ได้"
              unit="ครั้ง"
              readonly
            />
            <SettingRow
              id="lock-minutes"
              :model-value="String(data.lockMinutes)"
              label="ระยะเวลาที่ล็อก"
              hint="ปลดล็อกเองเมื่อครบเวลา"
              unit="นาที"
              readonly
            />

            <p v-if="formError" class="notice-error mb-3">{{ formError }}</p>

            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
              <p class="text-xs text-ink-muted">{{ lastEdit }}</p>
              <div class="flex gap-3">
                <button type="button" :disabled="pending" class="btn btn-secondary px-6 py-2.5 text-xs" @click="cancel">ยกเลิก</button>
                <button type="submit" :disabled="pending" class="btn btn-primary px-6 py-2.5 text-xs">
                  {{ pending ? 'กำลังบันทึก...' : 'บันทึก' }}
                </button>
              </div>
            </div>
          </form>

          <section class="card p-5" aria-labelledby="effects-title">
            <h2 id="effects-title" class="text-base font-bold text-ink">มีผลเมื่อไร</h2>
            <dl class="mt-3 divide-y divide-line border-t border-line">
              <div v-for="effect in effects" :key="effect.title" class="py-3 last:pb-0">
                <dt class="text-sm font-semibold text-ink">{{ effect.title }}</dt>
                <dd class="mt-0.5 text-xs text-slate-600">{{ effect.detail }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </AsyncState>
    </div>
  </div>
</template>
