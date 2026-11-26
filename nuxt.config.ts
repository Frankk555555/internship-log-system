import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Internship Work Log System',
      htmlAttrs: { lang: 'th' },
    },
  },
  runtimeConfig: {
    public: {
      // ตั้งผ่าน NUXT_PUBLIC_API_BASE ถ้าเว้นว่างจะใช้ข้อมูลจำลอง
      apiBase: '',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  ui: {
    colorMode: false,
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/ui',
  ],
})
