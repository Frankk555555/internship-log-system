<script setup lang="ts">
/**
 * ข้อผิดพลาดที่ค้างอยู่ในหน้าจนกว่าจะปิด ใช้คู่กับข้อความมุมจอซึ่งหายเอง
 * ข้อความมุมจอเป็นผู้ประกาศให้โปรแกรมอ่านหน้าจอ จึงไม่ใส่ role="alert" ซ้ำ
 */
defineProps<{
  title: string
  messages: string[]
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <div class="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
    <UIcon name="i-lucide-triangle-alert" class="mt-px size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p class="font-semibold">{{ title }}</p>
      <ul class="mt-1 space-y-0.5">
        <li v-for="message in messages" :key="message" class="break-words">{{ message }}</li>
      </ul>
    </div>
    <button type="button" class="-my-1 min-h-6 shrink-0 font-semibold underline underline-offset-2 hover:text-red-800" :aria-label="`ปิดข้อความ ${title}`" @click="$emit('close')">
      ปิด
    </button>
  </div>
</template>
