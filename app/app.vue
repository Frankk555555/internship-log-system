<script setup lang="ts">
import { th } from '@nuxt/ui/locale'

// ชื่อแท็บ: ชื่อหน้าก่อน ตามด้วยชื่อระบบ (WCAG 2.4.2)
const appName = 'Internship Work Log System'

useHead({
  titleTemplate: title => title && title !== appName ? `${title} · ${appName}` : appName,
})
</script>

<template>
  <UApp :locale="th" :toaster="{ position: 'top-right', ui: { viewport: 'print:hidden' } }">
    <!-- ประกาศชื่อหน้าใหม่ให้โปรแกรมอ่านหน้าจอเมื่อเปลี่ยนหน้า -->
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
