import { createApp } from './app.js'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { pingDatabase } from './database/pool.js'
import { ensureBuckets } from './services/storageService.js'
import { runMigrations } from './database/migrate.js'

async function bootstrap() {
  // Best-effort infra readiness before accepting traffic.
  const dbOk = await pingDatabase()
  if (!dbOk) {
    logger.warn('database not reachable at startup — continuing, /health/ready will report status')
  } else if (process.env.RUN_MIGRATIONS_ON_BOOT === 'true') {
    await runMigrations().catch((err) => logger.error({ err }, 'boot migrations failed'))
  }

  await ensureBuckets().catch((err) => logger.warn({ err }, 'ensureBuckets failed at startup'))

  const app = createApp()
  const server = app.listen(config.port, () => {
    logger.info(`🚀 Loikmon backend listening on :${config.port} (${config.env})`)
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down')
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

bootstrap().catch((err) => {
  logger.error({ err }, 'fatal boot error')
  process.exit(1)
})
