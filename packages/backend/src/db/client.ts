import { Kysely, MysqlDialect, sql } from 'kysely'
import { createPool, type Pool, type PoolOptions } from 'mysql2'
import type { AppConfig } from '../config/env.js'
import type { Database } from './types.js'

export interface DbHandle {
  db: Kysely<Database>
  dialect: MysqlDialect
  pool: Pool
  close: () => Promise<void>
}

/**
 * One mysql2 pool shared by the app's Kysely instance and Better Auth.
 *
 * - `timezone: 'Z'` stores and reads every DATETIME as UTC.
 * - TINYINT(1) is cast to boolean so rows match the TypeScript types.
 * - DECIMAL columns come back as numbers (ratings only; money is in cents).
 */
export function createDb(config: AppConfig['db']): DbHandle {
  const options: PoolOptions = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.poolSize,
    waitForConnections: true,
    enableKeepAlive: true,
    timezone: 'Z',
    charset: 'utf8mb4',
    decimalNumbers: true,
    supportBigNumbers: true,
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        const value = field.string()
        return value === null ? null : value === '1'
      }
      return next()
    },
  }
  const pool = createPool(options)
  const dialect = new MysqlDialect({ pool })
  const db = new Kysely<Database>({ dialect })
  return {
    db,
    dialect,
    pool,
    close: () => db.destroy(),
  }
}

export async function pingDb(db: Kysely<Database>): Promise<void> {
  await sql`SELECT 1`.execute(db)
}
