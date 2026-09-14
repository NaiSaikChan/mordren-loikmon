import mysql from 'mysql2/promise'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
  namedPlaceholders: true,
  timezone: 'Z',
  charset: 'utf8mb4',
})

export async function pingDatabase(): Promise<boolean> {
  try {
    const conn = await pool.getConnection()
    await conn.ping()
    conn.release()
    return true
  } catch (err) {
    logger.error({ err }, 'Database ping failed')
    return false
  }
}

/** Accepts positional (array) or named (object) bind params. */
export type QueryParams = unknown[] | Record<string, unknown>

/** Small typed query helper. */
export async function query<T = any>(sql: string, params?: QueryParams): Promise<T[]> {
  const [rows] = await pool.query(sql, params as any)
  return rows as T[]
}

export async function queryOne<T = any>(
  sql: string,
  params?: QueryParams,
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows.length ? rows[0] : null
}
