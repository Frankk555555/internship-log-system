<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true })
useHead({ title: 'เข้าถึงรายการนี้ไม่ได้' })

const user = useSessionUser()
</script>

<template>
  <div>
    <AuthHeading title="เข้าถึงรายการนี้ไม่ได้" mark="alert">
      <p class="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-rose-700">
        <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0" />
        รายการที่ขออยู่นอกขอบเขตข้อมูลที่คุณมีสิทธิ์ดู
      </p>
    </AuthHeading>

    <NuxtLink :to="homePathFor(user?.role)" class="text-[13px] font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
      กลับหน้าหลัก
    </NuxtLink>
  </div>
</template>
