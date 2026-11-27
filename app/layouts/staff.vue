<script setup lang="ts">
const user = useSessionUser()
const route = useRoute()

// พี่เลี้ยงและแอดมินใช้ layout เดียวกัน ต่างกันที่ชื่อพื้นที่และเมนู
const role = computed<'supervisor' | 'admin'>((previous) => {
  const current = user.value?.role
  if (current === 'supervisor' || current === 'admin') return current
  // ระหว่างออกจากระบบคงเมนูเดิม ถ้าโหลดผู้ใช้ไม่สำเร็จดูจากเส้นทาง
  return previous ?? (route.path.startsWith('/admin') ? 'admin' : 'supervisor')
})
</script>

<template>
  <div class="min-h-screen bg-page font-sans text-ink print:bg-white">
    <SkipLink />
    <AppSidebar :role="role" :user="user ?? undefined" />

    <main id="main-content" tabindex="-1" class="outline-none min-h-screen px-4 py-5 sm:px-6 lg:ml-[11.25rem] lg:px-5 lg:py-6 print:m-0 print:min-h-0 print:p-0">
      <div class="mx-auto max-w-[76.25rem]">
        <slot />
      </div>
    </main>
  </div>
</template>
