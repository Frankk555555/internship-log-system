// การต่อฐานข้อมูลตาม docs/erd-review.md หัวข้อ "การตั้งค่าการเชื่อมต่อ"
import mysql, { type Pool, type PoolConnection } from 'mysql2/promise'

const sqlMode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'

export function createDatabase(url: string): Pool {
  const pool = mysql.createPool({
    uri: url,
    // คืน DATE, TIME, DATETIME เป็นข้อความ ป้องกันวันที่เลื่อนจากการแปลงโซนเวลา
    dateStrings: true,
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
    connectionLimit: 10,
    connectTimeout: 5000,
  })

  // คำสั่งนี้เข้าคิวของการเชื่อมต่อก่อนคำสั่งของผู้ใช้เสมอ ตั้งไม่สำเร็จห้ามใช้การเชื่อมต่อนั้น
  pool.pool.on('connection', (connection) => {
    connection.query(`SET time_zone = '+00:00', sql_mode = '${sqlMode}'`, (error) => {
      if (error) connection.destroy()
    })
  })

  return pool
}

export async function transaction<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  }
  catch (error) {
    await connection.rollback()
    throw error
  }
  finally {
    connection.release()
  }
}
