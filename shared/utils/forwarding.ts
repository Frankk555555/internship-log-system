// ใช้ตอน Nuxt เรียก backend แทนเบราว์เซอร์ ทั้งตัวส่งต่อ /api และการ render ฝั่งเซิร์ฟเวอร์

/**
 * IP ของผู้ใช้ที่จะบอก backend ค่าเริ่มต้นใช้ที่อยู่ของการเชื่อมต่อจริง เพราะ header ที่ client ส่งมาปลอมได้
 * trust = มี reverse proxy ของระบบอยู่หน้า Nuxt ใช้ค่าท้ายสุดของ X-Forwarded-For ซึ่ง proxy นั้นเป็นผู้เติม
 */
export function clientAddress(remoteAddress: string | undefined, forwardedFor: string | undefined, trust: boolean) {
  const added = trust ? forwardedFor?.split(',').at(-1)?.trim() : undefined
  return added || remoteAddress
}

/** header "cookie" หลังรับ Set-Cookie จาก backend คำขอถัดไปของการ render เดียวกันจึงใช้ session ล่าสุด */
export function mergeCookies(header: string, setCookies: string[]) {
  const jar = new Map(header.split(';').map(part => part.trim()).filter(Boolean)
    .map(part => [part.split('=')[0]!, part] as const))

  for (const line of setCookies) {
    const [pair = '', ...attributes] = line.split(';').map(part => part.trim())
    const name = pair.split('=')[0]!
    if (!name) continue
    const expired = attributes.some((attribute) => {
      const [key = '', value = ''] = attribute.split('=')
      if (key.toLowerCase() === 'max-age') return Number(value) <= 0
      return key.toLowerCase() === 'expires' && Date.parse(value) <= Date.now()
    })
    if (expired) jar.delete(name)
    else jar.set(name, pair)
  }

  return [...jar.values()].join('; ')
}
