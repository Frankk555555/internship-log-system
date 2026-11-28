// อ่านและสร้างไฟล์ Excel ของข้อมูลจำลอง ระบบจริงให้เซิร์ฟเวอร์ทำ หน้าจอไม่อ่านไฟล์เอง
import { createXlsx } from '~/utils/xlsx'
import { ApiError } from './api'

const columns = {
  firstName: 'ชื่อ',
  lastName: 'นามสกุล',
  email: 'อีเมล',
  role: 'บทบาท',
  studentId: 'รหัสนักศึกษา',
}

type Column = keyof typeof columns

export type SheetRecord = Record<Column, string> & { row: number }

const unreadable = () => new ApiError('อ่านไฟล์ไม่ได้ ใช้ไฟล์ .xlsx ที่บันทึกจาก Excel หรือแบบฟอร์มของระบบ', 422)

/** ขนาดหลังคลายต่อไฟล์ย่อย กันไฟล์ที่บีบอัดผิดปกติ */
const maxEntryBytes = 20 * 1024 * 1024

/** คืนฟังก์ชันอ่านไฟล์ย่อยใน ZIP เป็นข้อความ */
function unzip(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const decoder = new TextDecoder()
  // ท้ายไฟล์ (end of central directory) อยู่ใน 22 + 65535 ไบต์สุดท้าย
  let end = buffer.byteLength - 22
  while (end >= Math.max(0, buffer.byteLength - 65_557) && view.getUint32(end, true) !== 0x06054B50) end--
  if (end < 0 || view.getUint32(end, true) !== 0x06054B50) throw unreadable()

  const entries = new Map<string, { method: number, size: number, start: number, length: number }>()
  let offset = view.getUint32(end + 16, true)
  for (let index = 0; index < view.getUint16(end + 10, true); index++) {
    if (view.getUint32(offset, true) !== 0x02014B50) throw unreadable()
    const nameLength = view.getUint16(offset + 28, true)
    const local = view.getUint32(offset + 42, true)
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength))
    entries.set(name, {
      method: view.getUint16(offset + 10, true),
      length: view.getUint32(offset + 20, true),
      size: view.getUint32(offset + 24, true),
      start: local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true),
    })
    offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }

  return async (path: string) => {
    const entry = entries.get(path)
    if (!entry) return undefined
    if (entry.size > maxEntryBytes || (entry.method !== 0 && entry.method !== 8)) throw unreadable()
    const data = new Uint8Array(buffer, entry.start, entry.length)
    if (entry.method === 0) return decoder.decode(data)
    return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
  }
}

// ใช้ namespace * เพราะบางโปรแกรมใส่ prefix หน้าชื่อแท็ก
const all = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS('*', tag))

function parseXml(text: string) {
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.getElementsByTagName('parsererror').length) throw unreadable()
  return document
}

/** ข้อความของเซลล์ ไม่รวมคำอ่าน (rPh) */
const textOf = (node: Element) => all(node, 't')
  .filter(item => item.parentElement?.localName !== 'rPh')
  .map(item => item.textContent ?? '')
  .join('')

/** A → 0, B → 1, AA → 26 */
const columnIndex = (reference: string) => [...reference.replace(/\d+$/, '')]
  .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1

function cellValue(cell: Element, shared: string[]) {
  const type = cell.getAttribute('t')
  if (type === 'inlineStr') return textOf(cell)
  const value = all(cell, 'v')[0]?.textContent ?? ''
  if (type === 's') return shared[Number(value)] ?? ''
  // ตัวเลขยาว เช่น รหัสนักศึกษา อาจเก็บแบบ 6.6E10 แปลงกลับเป็นตัวเลขเต็ม
  if ((!type || type === 'n') && value && Number.isSafeInteger(Number(value))) return String(Number(value))
  return value
}

/** แถวของชีตแรก แต่ละแถวเป็นข้อความตามลำดับคอลัมน์ */
async function readFirstSheet(file: File) {
  const read = unzip(await file.arrayBuffer())
  const workbook = await read('xl/workbook.xml')
  const relations = await read('xl/_rels/workbook.xml.rels')
  if (!workbook || !relations) throw unreadable()

  const sheet = all(parseXml(workbook), 'sheet')[0]
  const relationId = Array.from(sheet?.attributes ?? []).find(item => item.localName === 'id' && item.name.includes(':'))?.value
  const target = all(parseXml(relations), 'Relationship').find(item => item.getAttribute('Id') === relationId)?.getAttribute('Target')
  if (!target) throw unreadable()
  const content = await read(target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  if (!content) throw unreadable()

  const sharedXml = await read('xl/sharedStrings.xml')
  const shared = sharedXml ? all(parseXml(sharedXml), 'si').map(textOf) : []

  return all(parseXml(content), 'row').map((row, index) => {
    const cells: string[] = []
    let next = 0
    for (const cell of all(row, 'c')) {
      const reference = cell.getAttribute('r')
      const column = reference ? columnIndex(reference) : next
      cells[column] = cellValue(cell, shared).trim()
      next = column + 1
    }
    return { row: Number(row.getAttribute('r')) || index + 1, cells }
  })
}

/** แถวข้อมูลตามหัวตารางในแถวแรก สลับลำดับคอลัมน์ได้ ข้ามแถวว่าง */
export async function readUserSheet(file: File, maxRows: number): Promise<SheetRecord[]> {
  const rows = await readFirstSheet(file).catch((problem) => {
    throw problem instanceof ApiError ? problem : unreadable()
  })
  const headings = rows.find(item => item.row === 1)?.cells ?? []
  const positions = Object.entries(columns).map(([key, title]) => [key as Column, headings.indexOf(title)] as const)
  const missing = positions.filter(([, position]) => position < 0).map(([key]) => columns[key])
  if (missing.length) throw new ApiError(`แถวแรกต้องมีคอลัมน์ ${missing.join(', ')}`, 422)

  const records = rows.filter(item => item.row > 1).map(({ row, cells }) => ({
    row,
    ...Object.fromEntries(positions.map(([key, position]) => [key, cells[position] ?? ''])) as Record<Column, string>,
  })).filter(record => positions.some(([key]) => record[key]))

  if (!records.length) throw new ApiError('ไฟล์ไม่มีข้อมูลผู้ใช้ใต้หัวตาราง', 422)
  if (records.length > maxRows) throw new ApiError(`นำเข้าได้ครั้งละไม่เกิน ${maxRows} แถว`, 422)
  return records
}

export const userSheetTemplate = () => createXlsx('ผู้ใช้', [Object.values(columns)], [18, 18, 32, 14, 18])
