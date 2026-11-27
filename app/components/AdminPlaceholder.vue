<script setup lang="ts">
/** หน้าของแอดมินที่ยังไม่ได้ทำ แต่ละโมดูลแทนด้วยหน้าจริงตาม docs/admin-plan.md */
defineProps<{
  title: string
  description: string
  /** ชื่อในเส้นทางหน้า ระบุเมื่อต่างจาก title */
  crumb?: string
}>()
</script>

<template>
  <div>
    <PageHeader :title="title" :description="description" :crumbs="[{ label: 'พื้นที่แอดมิน' }, { label: crumb ?? title }]" />

    <section class="card mt-4 flex flex-col items-center px-5 py-12 text-center">
      <UIcon name="i-lucide-construction" class="size-6 text-ink-muted" />
      <p class="mt-3 text-sm font-semibold text-ink">หน้านี้ยังไม่เปิดใช้งาน</p>
      <p class="mt-1 text-xs text-ink-muted">อยู่ระหว่างพัฒนา เมนูอื่นใช้งานได้ตามปกติ</p>
    </section>
  </div>
</template>
