import 'dotenv/config'
import type { Server } from 'node:http'
import { loadConfig } from './config/env.js'
import { createContainer } from './container.js'
import { createApp } from './http/app.js'
import { startJobs } from './jobs/scheduler.js'

async function main() {
  const config = loadConfig()
  const container = await createContainer(config, {}, { migrate: config.db.migrateOnBoot })
  const { ctx } = container
  const logger = ctx.logger

  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandled promise rejection'))
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception — exiting')
    process.exit(1)
  })

  try {
    await ctx.storage.ensureBuckets()
  } catch (err) {
    // Storage can recover later; the API still serves metadata meanwhile.
    logger.error({ err }, 'storage not ready — bucket initialisation failed')
  }

  const app = createApp(ctx)
  const server: Server = app.listen(config.port, config.host, () => {
    logger.info(
      {
        port: config.port,
        env: config.env,
        app_store: Boolean(ctx.apple),
        google_play: Boolean(ctx.google),
        legacy_login_migration: Boolean(ctx.legacyAuth),
      },
      'Loikmon backend listening',
    )
  })
  server.keepAliveTimeout = 65_000 // longer than Traefik's idle timeout
  server.headersTimeout = 66_000

  const stopJobs = config.jobs.enabled
    ? startJobs({ db: ctx.db, subscriptions: ctx.services.subscriptions, logger, reconcileIntervalMinutes: config.jobs.reconcileIntervalMinutes })
    : () => {}

  let shuttingDown = false
  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'shutting down')
    stopJobs()
    const force = setTimeout(() => {
      logger.warn('forced exit after 20s')
      process.exit(1)
    }, 20_000)
    force.unref()
    server.close(async () => {
      await container.close().catch((err: unknown) => logger.error({ err }, 'error closing database pool'))
      logger.info('shutdown complete')
      process.exit(0)
    })
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err: unknown) => {
  // The logger may not exist yet (e.g. invalid configuration).
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
