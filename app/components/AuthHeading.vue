<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  /** ไอคอนด้านบนหัวข้อ */
  mark?: 'logo' | 'alert' | 'success'
}>(), {
  mark: 'logo',
})
</script>

<template>
  <header class="mb-7 flex flex-col items-center text-center">
    <!-- โลโก้บ้าน -->
    <svg v-if="mark === 'logo'" viewBox="0 0 64 64" class="size-14" aria-hidden="true">
      <path d="M6 27.5c0-2.4 1.2-4.6 3.2-5.9L28.8 8.1a5.7 5.7 0 0 1 6.4 0l19.6 13.5c2 1.3 3.2 3.5 3.2 5.9V52a6 6 0 0 1-6 6H39V47a7 7 0 0 0-14 0v11H12a6 6 0 0 1-6-6Z" fill="none" stroke="#2680f5" stroke-width="5.5" stroke-linejoin="round" />
      <path d="M25 56V47a7 7 0 0 1 14 0v9" fill="none" stroke="#fcc419" stroke-width="5.5" stroke-linecap="round" />
    </svg>
    <UIcon v-else-if="mark === 'alert'" name="i-lucide-circle-alert" class="size-14 text-red-600" />
    <span v-else class="flex size-12 items-center justify-center rounded-full bg-green-700 text-white">
      <UIcon name="i-lucide-check" class="size-8" />
    </span>

    <h2 class="mt-5 text-2xl font-bold text-slate-900">{{ title }}</h2>
    <div class="mt-3 text-sm leading-relaxed text-slate-500">
      <slot />
    </div>
  </header>
</template>
