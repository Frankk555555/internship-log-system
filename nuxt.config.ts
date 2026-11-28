import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Internship Work Log System',
      htmlAttrs: { lang: 'th' },
      // โหลดน้ำหนักที่ใช้มากที่สุดก่อน CSS จะเรียก ลดการสลับฟอนต์ตอนเปิดหน้า
      link: [400, 600].map(weight => ({
        rel: 'preload' as const,
        as: 'font' as const,
        type: 'font/woff2',
        href: `/fonts/bai-jamjuree-${weight}.woff2`,
        crossorigin: 'anonymous' as const,
      })),
    },
  },
  runtimeConfig: {
    // ที่อยู่ backend ที่เซิร์ฟเวอร์ Nuxt เรียก ใช้ส่งต่อ /api และตอน render (NUXT_API_SERVER_URL)
    apiServerUrl: '',
    // true เมื่อมี reverse proxy ของระบบอยู่หน้า Nuxt (NUXT_TRUST_FORWARDED_FOR)
    trustForwardedFor: false,
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
  hooks: {
    // ข้อมูลจำลองโหลดเมื่อเรียกใช้เท่านั้น ไม่ให้หน้าเว็บ prefetch ตอนต่อ backend จริง
    'build:manifest': (manifest) => {
      for (const chunk of Object.values(manifest)) {
        chunk.dynamicImports = chunk.dynamicImports?.filter(key => !manifest[key]?.name?.startsWith('mock'))
      }
    },
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/ui',
  ],
})
