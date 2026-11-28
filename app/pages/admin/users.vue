<script setup lang="ts">
import { ApiError, errorMessage } from '~/services/api'
import type { AccountStatus, AdminUser, UserFilter, UserInput } from '~/types/admin'

definePageMeta({ layout: 'staff', role: 'admin' })
useHead({ title: 'ผู้ใช้งาน' })

const api = useApi()
const sessionUser = useSessionUser()
const notify = useNotify()

const role = ref<UserFilter['role']>('all')
// เปิดจากหน้าภาพรวมพร้อมตัวกรองได้ เช่น ?status=locked
const requested = useRoute().query.status
const accountStatus = ref<UserFilter['status']>(requested === 'active' || requested === 'locked' || requested === 'suspended' ? requested : 'all')
const search = ref('')
const keyword = ref('')
const page = ref(1)

// รอพิมพ์เสร็จก่อนค้นหา ไม่ยิงคำขอทุกตัวอักษร
watch(search, (value, _previous, onCleanup) => {
  const timer = setTimeout(() => {
    keyword.value = value.trim()
  }, 300)
  onCleanup(() => clearTimeout(timer))
})

// เปลี่ยนตัวกรองแล้วเริ่มหน้าแรก ต้องประกาศก่อนโหลดข้อมูล
watch([role, accountStatus, keyword], () => {
  page.value = 1
})

const { data, status, error, refresh } = await useLazyAsyncData(
  'admin-users',
  () => api.getUsers({ role: role.value, status: accountStatus.value, q: keyword.value, page: page.value }),
  { watch: [role, accountStatus, keyword, page] },
)

const roleOptions = computed(() => ([
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'student', label: roleLabels.student },
  { value: 'supervisor', label: roleLabels.supervisor },
  { value: 'admin', label: roleLabels.admin },
] as const).map(option => ({ ...option, count: data.value?.counts[option.value] })))

const statusOptions = [
  { value: 'all', label: 'สถานะ: ทุกสถานะ' },
  { value: 'active', label: 'สถานะ: ใช้งาน' },
  { value: 'locked', label: 'สถานะ: ถูกล็อก' },
  { value: 'suspended', label: 'สถานะ: ระงับการใช้งาน' },
]

function statusBadge(target: AdminUser): { label: string, tone: 'green' | 'amber' | 'rose' } {
  const labels: Record<AccountStatus, string> = { active: 'ใช้งาน', locked: 'ถูกล็อก', suspended: 'ระงับการใช้งาน' }
  if (target.status === 'locked' && target.lockedUntil) return { label: `ล็อกถึง ${toThaiTimeParts(target.lockedUntil).time} น.`, tone: 'amber' }
  return { label: labels[target.status], tone: target.status === 'active' ? 'green' : target.status === 'locked' ? 'amber' : 'rose' }
}

// แยกวันที่กับเวลาเป็นสองชิ้น ตารางแคบจะขึ้นบรรทัดใหม่ระหว่างสองชิ้นนี้
function lastLogin(value?: string) {
  if (!value) return ['ยังไม่เคยเข้าใช้']
  const { date, time } = toThaiTimeParts(value)
  return [formatThaiDate(date), `• ${time} น.`]
}

const isSelf = (target: AdminUser) => target.email === sessionUser.value?.email

// เพิ่มและแก้ไข
const formOpen = ref(false)
const editing = ref<AdminUser>()
const saving = ref(false)
const saveError = ref<{ message: string, code?: string }>()

function openForm(target?: AdminUser) {
  editing.value = target
  saveError.value = undefined
  formOpen.value = true
}

async function save(input: UserInput) {
  if (saving.value) return
  saving.value = true
  saveError.value = undefined
  const target = editing.value
  const wasSelf = target ? isSelf(target) : false
  try {
    const saved = target ? await api.updateUser(target.id, input) : await api.createUser(input)
    formOpen.value = false
    // แก้บัญชีตัวเอง เมนูข้างต้องเห็นชื่อและอีเมลใหม่
    if (wasSelf) sessionUser.value = await api.getMe()
    if (target) {
      notify('success', 'บันทึกข้อมูลผู้ใช้แล้ว', saved.name)
    }
    else {
      showFirstPage()
      notify('success', 'เพิ่มผู้ใช้แล้ว', saved.role === 'student'
        ? `${saved.name} เข้าสู่ระบบครั้งแรกด้วยรหัสนักศึกษา`
        : `ส่งลิงก์ตั้งรหัสผ่านไปที่ ${saved.email}`)
    }
    await refresh()
  }
  catch (problem) {
    saveError.value = { message: errorMessage(problem), code: problem instanceof ApiError ? problem.code : undefined }
    notify('error', target ? 'บันทึกไม่สำเร็จ' : 'เพิ่มผู้ใช้ไม่สำเร็จ', saveError.value.message)
  }
  finally {
    saving.value = false
  }
}

// นำเข้าจาก Excel เปิดจากหน้าภาพรวมได้ด้วย ?import=new หรือ ?import=<รหัสการนำเข้า>
const route = useRoute()
const importQuery = typeof route.query.import === 'string' ? route.query.import : undefined
const importOpen = ref(false)
/** มีค่าเมื่อเปิดดูผลการนำเข้าที่ผ่านมา */
const viewingImport = ref<string>()

function openImport(importId?: string) {
  viewingImport.value = importId
  importOpen.value = true
}

onMounted(() => {
  if (importQuery) openImport(importQuery === 'new' ? undefined : importQuery)
})

// ปิดแล้วเอาคำสั่งออกจากที่อยู่หน้า โหลดใหม่จะไม่เปิดซ้ำ
watch(importOpen, (open) => {
  if (!open && route.query.import) useRouter().replace({ query: { ...route.query, import: undefined } })
})

function showFirstPage() {
  // ล้างตัวกรองให้เห็นบัญชีที่เพิ่งเพิ่ม
  role.value = 'all'
  accountStatus.value = 'all'
  search.value = ''
  keyword.value = ''
  page.value = 1
}

async function afterImport() {
  showFirstPage()
  await refresh()
}

// ระงับ เปิดใช้งาน และปลดล็อก
const suspendOpen = ref(false)
const suspending = ref<AdminUser>()
const suspendError = ref<string>()
const busyId = ref<number>()
const { error: actionError, clear: clearActionError, fail: failAction } = useFormNotice()

async function run(target: AdminUser, action: () => Promise<unknown>, title: string, description: string) {
  if (busyId.value) return
  busyId.value = target.id
  clearActionError()
  try {
    await action()
    await refresh()
    notify('success', title, description)
  }
  catch (problem) {
    failAction(errorMessage(problem), 'ทำรายการไม่สำเร็จ')
  }
  finally {
    busyId.value = undefined
  }
}

function askSuspend(target: AdminUser) {
  suspending.value = target
  suspendError.value = undefined
  suspendOpen.value = true
}

async function confirmSuspend() {
  const target = suspending.value
  if (!target || busyId.value) return
  busyId.value = target.id
  suspendError.value = undefined
  try {
    await api.setUserSuspended(target.id, true)
    suspendOpen.value = false
    await refresh()
    notify('success', 'ระงับบัญชีแล้ว', target.name)
  }
  catch (problem) {
    suspendError.value = errorMessage(problem)
    notify('error', 'ระงับบัญชีไม่สำเร็จ', suspendError.value)
  }
  finally {
    busyId.value = undefined
  }
}

function menuFor(target: AdminUser) {
  const unlock = {
    label: 'ปลดล็อกบัญชี',
    icon: 'i-lucide-lock-open',
    onSelect: () => run(target, () => api.unlockUser(target.id), 'ปลดล็อกบัญชีแล้ว', `${target.name} เข้าสู่ระบบได้ทันที`),
  }
  const suspension = target.status === 'suspended'
    ? {
        label: 'เปิดใช้งานอีกครั้ง',
        icon: 'i-lucide-user-check',
        onSelect: () => run(target, () => api.setUserSuspended(target.id, false), 'เปิดใช้งานบัญชีแล้ว', target.name),
      }
    : isSelf(target)
      ? { label: 'ระงับบัญชีของตัวเองไม่ได้', icon: 'i-lucide-ban', disabled: true }
      : { label: 'ระงับการใช้งาน', icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => askSuspend(target) }
  return target.status === 'locked' ? [unlock, suspension] : [suspension]
}
</script>

<template>
  <div>
    <PageHeader
      title="ผู้ใช้งาน"
      description="บัญชีนักศึกษา พี่เลี้ยง และแอดมิน อีเมลและรหัสนักศึกษาซ้ำกันไม่ได้"
      :crumbs="[{ label: 'พื้นที่แอดมิน' }, { label: 'ผู้ใช้งาน' }]"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-secondary shrink-0 gap-1.5 px-4 py-2.5 text-xs" @click="openImport()">
            <UIcon name="i-lucide-file-spreadsheet" class="size-4" />
            นำเข้าจาก Excel
          </button>
          <button type="button" class="btn btn-primary shrink-0 px-5 py-2.5 text-xs" @click="openForm()">เพิ่มผู้ใช้</button>
        </div>
      </template>
    </PageHeader>

    <ErrorNotice v-if="actionError" class="mt-4" title="ทำรายการไม่สำเร็จ" :messages="[actionError]" @close="clearActionError" />

    <div class="mt-4">
      <AsyncState :loading="!data && status !== 'error'" :error="error" @retry="refresh()">
        <section v-if="data" class="card @container overflow-hidden" aria-labelledby="user-list-title">
          <h2 id="user-list-title" class="sr-only">รายชื่อผู้ใช้</h2>

          <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <FilterChips v-model="role" label="กรองตามบทบาท" :options="roleOptions" />
            <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div class="w-full sm:w-48">
                <SelectField id="user-status-filter" v-model="accountStatus" label="กรองตามสถานะบัญชี" hide-label :options="statusOptions" />
              </div>
              <label class="relative block w-full sm:w-64">
                <span class="sr-only">ค้นหาชื่อ อีเมล หรือรหัสนักศึกษา</span>
                <UIcon name="i-lucide-search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
                <input v-model="search" type="search" placeholder="ค้นหาชื่อ อีเมล หรือรหัสนักศึกษา" class="field h-10 w-full bg-white pl-9 pr-3 text-xs text-slate-800">
              </label>
            </div>
          </div>

          <!-- relative: ข้อความสำหรับโปรแกรมอ่านหน้าจอในตารางไม่ดันหน้าให้กว้างเกิน -->
          <div class="relative overflow-x-auto border-t border-line">
            <table class="w-full min-w-[50rem] table-fixed border-collapse text-left" :aria-busy="status === 'pending'">
              <thead>
                <tr class="bg-page text-2xs font-semibold text-slate-600">
                  <th class="px-5 py-3">ผู้ใช้</th>
                  <th class="w-[5.5rem] px-2 py-3">บทบาท</th>
                  <th class="w-[7.5rem] px-2 py-3">รหัสนักศึกษา</th>
                  <th class="w-[8.5rem] px-2 py-3">สถานะบัญชี</th>
                  <th class="w-[7rem] px-2 py-3 @5xl:w-[10.5rem]">เข้าใช้ล่าสุด</th>
                  <th class="w-[8rem] px-3 py-3"><span class="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody class="text-xs text-slate-600">
                <tr v-for="item in data.items" :key="item.id" class="border-t border-line align-middle hover:bg-page">
                  <td class="px-5 py-3.5">
                    <p class="font-semibold text-ink">{{ item.name }}</p>
                    <p class="mt-0.5 break-all text-2xs">{{ item.email }}</p>
                  </td>
                  <td class="px-2 py-3.5">{{ roleLabels[item.role] }}</td>
                  <td class="break-all px-2 py-3.5 tabular-nums">{{ item.studentId ?? '–' }}</td>
                  <td class="px-2 py-3.5"><StatusBadge v-bind="statusBadge(item)" /></td>
                  <td class="px-2 py-3.5">
                    <template v-for="(part, index) in lastLogin(item.lastLoginAt)" :key="index">
                      <span class="inline-block whitespace-nowrap">{{ part }}</span>{{ ' ' }}
                    </template>
                  </td>
                  <td class="px-3 py-3.5">
                    <div class="flex items-center justify-end gap-1">
                      <button type="button" class="btn btn-secondary px-3 py-1.5 text-2xs" :disabled="busyId === item.id" :aria-label="`แก้ไข ${item.name}`" @click="openForm(item)">แก้ไข</button>
                      <UDropdownMenu :items="menuFor(item)" :content="{ align: 'end' }" :ui="{ content: 'min-w-52 bg-white ring-line' }">
                        <button type="button" class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-line disabled:cursor-not-allowed disabled:opacity-50" :disabled="busyId === item.id" :aria-label="`ตัวเลือกเพิ่มเติมของ ${item.name}`">
                          <UIcon name="i-lucide-ellipsis" class="size-4" />
                        </button>
                      </UDropdownMenu>
                    </div>
                  </td>
                </tr>
                <tr v-if="!data.items.length" class="border-t border-line">
                  <td colspan="6" class="px-5 py-12 text-center text-sm text-ink-muted">ไม่พบผู้ใช้ที่ตรงกับตัวกรอง</td>
                </tr>
              </tbody>
            </table>
          </div>

          <TablePagination v-model:page="page" :total="data.total" :page-size="data.pageSize" unit="คน" :disabled="status === 'pending'" />
        </section>
      </AsyncState>
    </div>

    <UserFormModal v-model:open="formOpen" :user="editing" :pending="saving" :server-error="saveError" @save="save" />
    <UserImportModal v-model:open="importOpen" :import-id="viewingImport" @imported="afterImport" />

    <SuspendUserModal v-model:open="suspendOpen" :user="suspending" :pending="Boolean(busyId)" :server-error="suspendError" @confirm="confirmSuspend" />
  </div>
</template>
