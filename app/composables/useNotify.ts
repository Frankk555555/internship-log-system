/** แจ้งผลการทำรายการมุมขวาบน พร้อมแถบเวลาก่อนปิดเอง */
export function useNotify() {
  const toast = useToast()

  const kinds = {
    success: { icon: 'i-lucide-check', color: 'success' as const, circle: 'bg-emerald-100', mark: 'text-emerald-700' },
    returned: { icon: 'i-lucide-rotate-ccw', color: 'warning' as const, circle: 'bg-sendback', mark: 'text-white' },
    info: { icon: 'i-lucide-info', color: 'primary' as const, circle: 'bg-indigo-100', mark: 'text-brand' },
    error: { icon: 'i-lucide-triangle-alert', color: 'error' as const, circle: 'bg-red-100', mark: 'text-danger' },
  }

  return (kind: keyof typeof kinds, title: string, description: string) => {
    const { icon, color, circle, mark } = kinds[kind]
    toast.add({
      title,
      description,
      // ใช้ avatar เพื่อให้ได้ไอคอนในวงกลมตามภาพออกแบบ
      avatar: { icon, ui: { root: `size-8 ${circle}`, icon: `size-4 ${mark}` } },
      color,
      duration: 6000,
      ui: {
        root: 'items-start gap-3 bg-white ring-slate-200',
        title: 'text-xs font-bold text-ink',
        description: 'whitespace-pre-line text-2xs text-ink-muted',
        // ปุ่มปิดกดได้อย่างน้อย 24px (WCAG 2.5.8)
        close: 'size-6 justify-center',
      },
    })
  }
}
