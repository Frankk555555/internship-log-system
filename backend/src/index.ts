import { createApp } from './app'
import { readConfig } from './config'
import { createDatabase } from './database'

const config = readConfig()
const db = createDatabase(config.databaseUrl)

// ต่อฐานข้อมูลไม่ได้ให้หยุดตั้งแต่เปิด พร้อมบอกสาเหตุ
await db.query('SELECT 1')

createApp({ db, config }).listen({ hostname: config.host, port: config.port })
console.log(`backend พร้อมที่ http://${config.host}:${config.port}`)
