<script setup lang="ts">
definePageMeta({ role: 'student' })
useHead({ title: 'ข้อมูลสถานที่ฝึกงาน' })

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
    <PageHeader
      class="mb-4"
      title="ข้อมูลสถานที่ฝึกงาน"
      description="รายละเอียดการฝึกงานและพี่เลี้ยง"
      :crumbs="[{ label: 'พื้นที่นักศึกษา' }, { label: 'ข้อมูลสถานที่ฝึกงาน' }]"
    />

    <div class="lg:w-[61%]">
      <AsyncState :loading="!internship && status !== 'error'" :error="error" @retry="refresh()">
        <div v-if="internship" class="card p-5">
          <h2 class="text-base font-bold text-ink">สถานที่และระยะเวลา</h2>

          <div v-for="field in fields" :key="field.id" class="mt-3 flex flex-col first-of-type:mt-4">
            <label :for="field.id" class="text-xs font-semibold text-slate-600">{{ field.label }}</label>
            <div class="mt-1.5 flex items-center rounded-lg border border-control bg-page focus-within:border-brand focus-within:ring-2 focus-within:ring-brand">
              <input :id="field.id" :value="field.value" type="text" readonly class="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-slate-700 outline-hidden">
              <UIcon v-if="field.icon" :name="field.icon" class="mr-3 size-4 shrink-0 text-slate-700" />
            </div>
          </div>

          <h2 class="mt-7 text-base font-bold text-ink">พี่เลี้ยงที่ได้รับมอบหมาย</h2>
          <dl class="mt-3">
            <dt class="text-xs font-semibold text-slate-600">ชื่อพี่เลี้ยง</dt>
            <dd class="mt-0.5 text-[0.8125rem] font-semibold text-ink">{{ internship.mentorName }}</dd>
          </dl>

          <div class="mt-14 flex justify-end">
            <BackButton fallback="/worklogs" />
          </div>
        </div>
      </AsyncState>
    </div>
  </div>
</template>
