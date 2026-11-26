<script setup lang="ts">
definePageMeta({ role: 'student' })

const api = useApi()
const { data: internship, status, error, refresh } = await useLazyAsyncData('internship', () => api.getInternship())

// นักศึกษาดูได้อย่างเดียว ช่วงฝึกงาน เวลาเข้า–เลิกงาน และพี่เลี้ยงกำหนดโดยแอดมิน (ขอบเขตงานข้อ 3)
const fields = computed(() => {
  const info = internship.value
  if (!info) return []

  return [
    { id: 'internship-company', label: 'สถานประกอบการ', value: info.company },
    { id: 'internship-position', label: 'ตำแหน่ง', value: info.position },
    { id: 'internship-start', label: 'วันเริ่มต้นการฝึกงาน', value: formatThaiDate(info.startDate), icon: 'i-lucide-calendar' },
    { id: 'internship-end', label: 'วันสิ้นสุดการฝึกงาน', value: formatThaiDate(info.endDate), icon: 'i-lucide-calendar' },
    { id: 'internship-work-start', label: 'เวลาเข้างาน', value: `${info.workStartTime} น.`, icon: 'i-lucide-clock' },
    { id: 'internship-work-end', label: 'เวลาเลิกงาน', value: `${info.workEndTime} น.`, icon: 'i-lucide-clock' },
  ]
})
</script>

<template>
  <div>
    <header class="mb-4 border-b border-slate-200 pb-5">
      <nav class="flex items-center gap-2 text-[11px] font-medium text-slate-400" aria-label="breadcrumb">
        <span>พื้นที่นักศึกษา</span>
        <span>/</span>
        <span class="text-slate-500">ข้อมูลสถานที่ฝึกงาน</span>
      </nav>
      <h2 class="mt-2 text-2xl font-bold text-slate-900">ข้อมูลสถานที่ฝึกงาน</h2>
      <p class="mt-1 text-xs text-slate-500">รายละเอียดการฝึกงานและพี่เลี้ยง</p>
    </header>

    <div class="lg:w-[61%]">
      <AsyncState :loading="!internship && status !== 'error'" :error="error" @retry="refresh()">
        <div v-if="internship" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 class="text-base font-semibold text-slate-900">สถานที่และระยะเวลา</h3>

          <div v-for="field in fields" :key="field.id" class="mt-3 flex flex-col first-of-type:mt-4">
            <label :for="field.id" class="text-xs font-semibold text-slate-600">{{ field.label }}</label>
            <div class="mt-1.5 flex items-center rounded-lg border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
              <input :id="field.id" :value="field.value" type="text" readonly class="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-slate-700 outline-none">
              <UIcon v-if="field.icon" :name="field.icon" class="mr-3 size-4 shrink-0 text-slate-700" />
            </div>
          </div>

          <h3 class="mt-7 text-base font-semibold text-slate-900">พี่เลี้ยงที่ได้รับมอบหมาย</h3>
          <dl class="mt-3">
            <dt class="text-xs font-semibold text-slate-600">ชื่อพี่เลี้ยง</dt>
            <dd class="mt-0.5 text-[13px] font-semibold text-slate-900">{{ internship.mentorName }}</dd>
          </dl>

          <div class="mt-14 flex justify-end">
            <BackButton fallback="/worklogs" />
          </div>
        </div>
      </AsyncState>
    </div>
  </div>
</template>
