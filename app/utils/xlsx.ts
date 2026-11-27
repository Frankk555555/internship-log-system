// สร้างไฟล์ .xlsx แบบ 1 ชีต โดยไม่ต้องใช้ไลบรารีภายนอก (ZIP แบบไม่บีบอัด)

export type SheetCell = string | number

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF]! ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/** แปลงรายการ [ค่า, จำนวนไบต์] เป็นข้อมูลแบบ little-endian */
function header(fields: [number, 2 | 4][]) {
  const bytes = new Uint8Array(fields.reduce((total, [, size]) => total + size, 0))
  const view = new DataView(bytes.buffer)
  let offset = 0
  for (const [value, size] of fields) {
    if (size === 2) view.setUint16(offset, value, true)
    else view.setUint32(offset, value, true)
    offset += size
  }
  return bytes
}

function zip(files: Record<string, string>) {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const directory: Uint8Array[] = []
  let offset = 0

  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path)
    const data = encoder.encode(content)
    // version, flags (ชื่อไฟล์ UTF-8), method, time, date (1980-01-01), crc, ขนาด, ความยาวชื่อ, extra
    const common: [number, 2 | 4][] = [[20, 2], [0x0800, 2], [0, 2], [0, 2], [0x21, 2], [crc32(data), 4], [data.length, 4], [data.length, 4], [name.length, 2], [0, 2]]
    const local = header([[0x04034B50, 4], ...common])
    parts.push(local, name, data)
    directory.push(header([[0x02014B50, 4], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]), name)
    offset += local.length + name.length + data.length
  }

  const directorySize = directory.reduce((total, part) => total + part.length, 0)
  const count = Object.keys(files).length
  const end = header([[0x06054B50, 4], [0, 2], [0, 2], [count, 2], [count, 2], [directorySize, 4], [offset, 4], [0, 2]])

  return [...parts, ...directory, end]
}

function escapeXml(text: string) {
  return text
    // อักขระควบคุมใช้ใน XML ไม่ได้
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function cellXml(cell: SheetCell, column: number, row: number) {
  const reference = `${String.fromCharCode(65 + column)}${row}`
  if (typeof cell === 'number') return `<c r="${reference}"><v>${cell}</v></c>`
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`
}

/** รองรับสูงสุด 26 คอลัมน์ (A–Z) */
export function createXlsx(sheetName: string, rows: SheetCell[][], columnWidths: number[]) {
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const relations = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const packageRelations = 'http://schemas.openxmlformats.org/package/2006/relationships'
  const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml'

  const columns = columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')
  const data = rows.map((cells, index) => `<row r="${index + 1}">${cells.map((cell, column) => cellXml(cell, column, index + 1)).join('')}</row>`).join('')

  const parts = zip({
    '[Content_Types].xml': `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${contentType}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${contentType}.worksheet+xml"/></Types>`,
    '_rels/.rels': `${xml}<Relationships xmlns="${packageRelations}"><Relationship Id="rId1" Type="${relations}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${xml}<workbook xmlns="${main}" xmlns:r="${relations}"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${xml}<Relationships xmlns="${packageRelations}"><Relationship Id="rId1" Type="${relations}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `${xml}<worksheet xmlns="${main}"><cols>${columns}</cols><sheetData>${data}</sheetData></worksheet>`,
  })

  return new Blob(parts as BlobPart[], { type: `${contentType}.sheet` })
}
