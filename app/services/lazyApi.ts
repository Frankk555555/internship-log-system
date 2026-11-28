import type { Api } from './api'

/** Api ที่โหลดโค้ดของตัวจริงเมื่อมีการเรียกครั้งแรก ทุกเมธอดคืน Promise อยู่แล้ว ผู้เรียกจึงใช้เหมือนเดิม */
export function createLazyApi(load: () => Promise<Api>): Api {
  let loading: Promise<Api> | undefined

  return new Proxy({} as Api, {
    get(_target, key) {
      // ตัว Api เองไม่ใช่ Promise
      if (typeof key !== 'string' || key === 'then') return undefined

      return async (...args: unknown[]) => {
        loading ??= load()
        const api = await loading
        const method = api[key as keyof Api] as (...values: unknown[]) => unknown
        return method(...args)
      }
    },
  })
}
