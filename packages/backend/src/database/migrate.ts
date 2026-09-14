/**
 * Idempotent migration runner. Applies every .sql file in migrations/ in
 * lexical order, tracking applied files in a `_migrations` table.
 *
 * Run: npm run db:migrate
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'
import { logger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
}

async function appliedSet(): Promise<Set<string>> {
  const [rows] = await pool.query('SELECT filename FROM _migrations')
  return new Set((rows as { filename: string }[]).map((r) => r.filename))
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable()
  const applied = await appliedSet()
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    if (applied.has(file)) {
      logger.debug({ file }, 'migration already applied, skipping')
      continue
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      // Split on ; at end of line to run multiple statements.
      const statements = sql
        .split(/;\s*$/m)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'))
      for (const stmt of statements) {
        await conn.query(stmt)
      }
      await conn.query('INSERT INTO _migrations (filename) VALUES (?)', [file])
      await conn.commit()
      logger.info({ file }, 'migration applied')
    } catch (err) {
      await conn.rollback()
      logger.error({ file, err }, 'migration failed — rolled back')
      throw err
    } finally {
      conn.release()
    }
  }
  logger.info('migrations complete')
}

// Execute when run directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
