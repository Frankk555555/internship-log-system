<script setup lang="ts">
const { user } = useWorklogs()
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-900">
    <AppSidebar :user="user" />

    <div class="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <p class="text-sm font-semibold">Internship Work Log System</p>
      <p class="text-xs text-slate-500">Student Workspace</p>
    </div>

    <main class="min-h-screen px-4 py-5 sm:px-6 lg:ml-[180px] lg:px-5 lg:py-6">
      <div class="mx-auto max-w-[1220px]">
        <slot />
      </div>
    </main>
  </div>
</template>
