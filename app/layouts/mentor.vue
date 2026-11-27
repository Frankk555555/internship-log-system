<script setup lang="ts">
const user = useSessionUser()
</script>

<template>
  <div class="min-h-screen bg-page font-sans text-ink print:bg-white">
    <SkipLink />
    <AppSidebar role="supervisor" :user="user ?? undefined" />

    <main id="main-content" tabindex="-1" class="outline-none min-h-screen px-4 py-5 sm:px-6 lg:ml-[11.25rem] lg:px-5 lg:py-6 print:m-0 print:min-h-0 print:p-0">
      <div class="mx-auto max-w-[76.25rem]">
        <slot />
      </div>
    </main>
  </div>
</template>
