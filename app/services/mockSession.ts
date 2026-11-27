// session ของข้อมูลจำลอง เก็บอีเมลไว้ใน cookie เพื่อให้ฝั่งเซิร์ฟเวอร์อ่านได้ตอน render
// backend จริงใช้ session cookie แบบ HttpOnly ที่ client อ่านไม่ได้

const name = 'mock_session'
const rememberSeconds = 30 * 24 * 60 * 60

export interface MockSession {
  read(): string | undefined
  write(email: string | undefined, remember?: boolean): void
}

/** serverCookie: header "cookie" ของคำขอ ใช้ตอน render ฝั่งเซิร์ฟเวอร์ */
export function createMockSession(serverCookie?: string): MockSession {
  return {
    read() {
      const header = import.meta.server ? serverCookie ?? '' : document.cookie
      const value = header.split('; ').find(part => part.startsWith(`${name}=`))?.slice(name.length + 1)
      return value ? decodeURIComponent(value) : undefined
    },
    write(email, remember) {
      const base = `${name}=${email ? encodeURIComponent(email) : ''}; path=/; SameSite=Lax`
      const age = email ? (remember ? `; max-age=${rememberSeconds}` : '') : '; max-age=0'
      document.cookie = base + age
    },
  }
}
