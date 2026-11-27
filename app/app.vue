<script setup lang="ts">
// ชื่อแท็บ: ชื่อหน้าก่อน ตามด้วยชื่อระบบ (WCAG 2.4.2)
const appName = 'Internship Work Log System'

useHead({
  titleTemplate: title => title && title !== appName ? `${title} · ${appName}` : appName,
})
</script>

<template>
  <UApp :toaster="{ position: 'top-right', ui: { viewport: 'print:hidden' } }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
