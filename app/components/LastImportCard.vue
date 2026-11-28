<script setup lang="ts">
import type { ImportSummary } from '~/types/admin'

const props = defineProps<{
  /** ไม่มีค่าเมื่อยังไม่เคยนำเข้า */
  summary?: ImportSummary
}>()

const when = computed(() => {
  const imported = props.summary?.imported
  if (!imported) return ''
  const { date, time } = toThaiTimeParts(imported.at)
  return `${formatThaiDate(date)} • ${time} น. โดย ${imported.by}`
})
</script>

<template>
  <section class="card px-5 py-4" aria-labelledby="last-import-title">
    <h2 id="last-import-title" class="text-base font-bold text-ink">นำเข้าผู้ใช้ล่าสุด</h2>

    <template v-if="summary">
      <div class="mt-3 flex items-start gap-3">
        <UIcon name="i-lucide-file-spreadsheet" class="mt-0.5 size-5 shrink-0 text-emerald-700" />
        <div class="min-w-0">
          <p class="break-all text-sm font-semibold text-ink">{{ summary.fileName }}</p>
          <p class="mt-0.5 text-2xs tabular-nums text-slate-600">{{ when }}</p>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <StatusBadge :label="`สำเร็จ ${summary.readyCount} รายการ`" tone="green" />
        <StatusBadge v-if="summary.errorCount" :label="`ข้อผิดพลาด ${summary.errorCount} รายการ`" tone="rose" />
      </div>
      <NuxtLink :to="{ path: '/admin/users', query: { import: summary.importId } }" class="btn btn-secondary mt-3 inline-flex min-h-10 px-4 text-xs">
        ดูผลการนำเข้า
      </NuxtLink>
    </template>

    <div v-else class="mt-3 border-t border-line pt-4 text-center">
      <p class="text-xs text-ink-muted">ยังไม่เคยนำเข้าผู้ใช้</p>
      <NuxtLink :to="{ path: '/admin/users', query: { import: 'new' } }" class="btn btn-secondary mt-3 inline-flex min-h-10 px-4 text-xs">
        นำเข้าจาก Excel
      </NuxtLink>
    </div>
  </section>
</template>
