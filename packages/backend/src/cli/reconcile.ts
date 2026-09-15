import 'dotenv/config'
import { loadConfig } from '../config/env.js'
import { createContainer } from '../container.js'

/** `npm run jobs:reconcile` — re-check subscriptions against Apple/Google once. */
const config = loadConfig()
const container = await createContainer(config)
const { subscriptions } = container.ctx.services
try {
  const result = await subscriptions.reconcile({ limit: Number(process.argv[2] ?? 1000) })
  const expired = await subscriptions.expireLapsed()
  container.ctx.logger.info({ ...result, expired }, 'reconciliation finished')
} catch (err) {
  container.ctx.logger.error({ err }, 'reconciliation failed')
  process.exitCode = 1
} finally {
  await container.close()
}
