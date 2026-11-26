<script setup lang="ts">
const user = useSessionUser()
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-900 print:bg-white">
    <AppSidebar role="supervisor" :user="user ?? undefined" />

    <main class="min-h-screen px-4 py-5 sm:px-6 lg:ml-[180px] lg:px-5 lg:py-6 print:m-0 print:min-h-0 print:p-0">
      <div class="mx-auto max-w-[1220px]">
        <slot />
      </div>
    </main>
  </div>
</template>
