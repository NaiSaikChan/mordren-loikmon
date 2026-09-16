import { getMigrations } from 'better-auth/db/migration'
import type { BetterAuthOptions } from 'better-auth'
import { sql, type Kysely } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'
import type { Logger } from '../lib/logger.js'
import * as m0001 from './migrations/0001_content.js'
import * as m0002 from './migrations/0002_subscriptions.js'
import * as m0003 from './migrations/0003_cms.js'
import type { Database } from './types.js'

/** Migrations are bundled in code (no filesystem scanning), so dist/ and tsx behave the same. */
const provider: MigrationProvider = {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '0001_content': m0001,
      '0002_subscriptions': m0002,
      '0003_cms': m0003,
    }
  },
}

/**
 * Roll the most recent application migration back. Better Auth's own schema is
 * never touched: it is diffed forward only.
 *
 * This destroys whatever that migration created, so the CLI wrapping it
 * (`npm run db:migrate:down`) requires an explicit confirmation flag.
 */
export async function migrateDown(db: Kysely<Database>, logger: Logger): Promise<void> {
  await db.connection().execute(async (conn) => {
    const lock = await sql<{ acquired: number | null }>`SELECT GET_LOCK('loikmon_migrations', 120) AS acquired`.execute(conn)
    if (lock.rows[0]?.acquired !== 1) throw new Error('Could not acquire the migration lock within 120s')
    try {
      const migrator = new Migrator({ db: conn, provider })
      const { error, results } = await migrator.migrateDown()
      for (const r of results ?? []) {
        const log = r.status === 'Error' ? logger.error.bind(logger) : logger.warn.bind(logger)
        log({ migration: r.migrationName, status: r.status }, 'migration rolled back')
      }
      if (error) throw error instanceof Error ? error : new Error(String(error))
      if (!results?.length) logger.info('nothing to roll back')
    } finally {
      await sql`SELECT RELEASE_LOCK('loikmon_migrations')`.execute(conn)
    }
  })
}

/**
 * Bring the schema up to date:
 *  1. Better Auth tables (users, sessions, accounts, verifications) — diffed
 *     and created/altered by Better Auth for the installed version.
 *  2. Application tables — versioned Kysely migrations.
 *
 * A MySQL advisory lock keeps two containers from migrating at once.
 */
export async function migrateToLatest(db: Kysely<Database>, authOptions: BetterAuthOptions, logger: Logger): Promise<void> {
  await db.connection().execute(async (conn) => {
    const lock = await sql<{ acquired: number | null }>`SELECT GET_LOCK('loikmon_migrations', 120) AS acquired`.execute(conn)
    if (lock.rows[0]?.acquired !== 1) throw new Error('Could not acquire the migration lock within 120s')
    try {
      const auth = await getMigrations(authOptions)
      if (auth.toBeCreated.length || auth.toBeAdded.length) {
        logger.info(
          { create: auth.toBeCreated.map((t) => t.table), alter: auth.toBeAdded.map((t) => t.table) },
          'applying Better Auth schema changes',
        )
        await auth.runMigrations()
      }

      const migrator = new Migrator({ db: conn, provider })
      const { error, results } = await migrator.migrateToLatest()
      for (const r of results ?? []) {
        const log = r.status === 'Error' ? logger.error.bind(logger) : logger.info.bind(logger)
        log({ migration: r.migrationName, status: r.status }, 'migration')
      }
      if (error) throw error instanceof Error ? error : new Error(String(error))
    } finally {
      await sql`SELECT RELEASE_LOCK('loikmon_migrations')`.execute(conn)
    }
  })
}
