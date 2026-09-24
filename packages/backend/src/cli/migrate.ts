import 'dotenv/config'
import { loadConfig } from '../config/env.js'
import { createContainer } from '../container.js'

/** `npm run db:migrate` — apply Better Auth + application migrations, then exit. */
const config = loadConfig()
try {
  const container = await createContainer(config, {}, { migrate: true })
  container.ctx.logger.info('database is up to date')
  await container.close()
} catch (err) {
  console.error('migration failed:', err)
  process.exitCode = 1
}
