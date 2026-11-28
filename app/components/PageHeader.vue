<script setup lang="ts">
/** หัวหน้าเพจ: เส้นทาง ชื่อหน้า คำอธิบาย ใช้ร่วมกันทุกหน้าในพื้นที่ทำงาน */
withDefaults(defineProps<{
  /** เส้นทางจากพื้นที่ทำงานถึงหน้านี้ ระบุ to เมื่อกดกลับไปหน้านั้นได้ */
  crumbs: { label: string, to?: string }[]
  title: string
  description?: string
  /** ไม่มีเส้นคั่นด้านล่าง */
  plain?: boolean
  /** จอแคบให้ปุ่มด้านขวาลงมาอยู่ใต้ชื่อหน้า ใช้เมื่อมีหลายปุ่ม */
  stackActions?: boolean
}>(), {
  description: undefined,
})
</script>

<template>
  <header :class="plain ? '' : ['border-b border-line', $slots.default ? 'pb-3' : 'pb-5']">
    <div class="flex gap-4" :class="stackActions ? 'flex-col lg:flex-row lg:items-start lg:justify-between' : 'items-start justify-between'">
      <div>
        <!-- ปุ่มย้อนกลับ -->
        <div v-if="$slots.back" class="mb-3 empty:hidden">
          <slot name="back" />
        </div>
        <nav class="flex flex-wrap items-center gap-2 text-2xs font-medium text-ink-muted" aria-label="เส้นทางหน้า">
          <template v-for="(crumb, index) in crumbs" :key="crumb.label">
            <span v-if="index" aria-hidden="true">/</span>
            <NuxtLink v-if="crumb.to" :to="crumb.to" class="hover:text-slate-700">{{ crumb.label }}</NuxtLink>
            <span v-else>{{ crumb.label }}</span>
          </template>
        </nav>
        <h1 class="mt-2 text-2xl font-bold text-ink">{{ title }}</h1>
        <p v-if="description" class="mt-1 text-xs text-ink-muted">{{ description }}</p>
      </div>
      <slot name="actions" />
    </div>

    <!-- ตัวเลือกของหน้า เช่น สัปดาห์ หรือมุมมอง -->
    <div v-if="$slots.default" class="mt-3">
      <slot />
    </div>
  </header>
</template>
