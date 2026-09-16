import 'dotenv/config'
import { loadConfig } from '../config/env.js'
import { createDb } from '../db/client.js'
import { migrateDown } from '../db/migrate.js'
import { createLogger } from '../lib/logger.js'

/**
 * `npm run db:migrate:down -- --yes` — roll back the most recent application
 * migration.
 *
 * This drops whatever that migration created. Back the database up first; the
 * confirmation flag is deliberately not optional.
 */
const config = loadConfig()
const logger = createLogger(config)

if (!process.argv.includes('--yes')) {
  console.error(
    'Rolling back drops the tables and columns the last migration created.\n' +
      'Take a backup, then re-run with --yes to confirm:\n' +
      '  npm run db:migrate:down -- --yes',
  )
  process.exit(1)
}

const handle = createDb(config.db)
try {
  await migrateDown(handle.db, logger)
} catch (err) {
  logger.error({ err }, 'rollback failed')
  process.exitCode = 1
} finally {
  await handle.close()
}
