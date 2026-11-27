<script setup lang="ts">
// ย้ายโฟกัสด้วยโค้ด ไม่เปลี่ยน URL หน้าที่เก็บตัวเลือกไว้ใน URL จึงไม่ถูกกระทบ
function focusMain() {
  document.getElementById('main-content')?.focus()
}
</script>

<template>
  <!-- ซ่อนไว้เหนือจอ แสดงเมื่อกด Tab มาถึง ให้ข้ามเมนูได้ (WCAG 2.4.1) -->
  <a
    href="#main-content"
    class="fixed left-3 top-3 z-[60] -translate-y-24 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white focus:translate-y-0 print:hidden"
    @click.prevent="focusMain"
  >
    ข้ามไปยังเนื้อหาหลัก
  </a>
</template>
