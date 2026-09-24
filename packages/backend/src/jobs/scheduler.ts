import { sql, type Kysely } from 'kysely'
import type { Database } from '../db/types.js'
import type { Logger } from '../lib/logger.js'
import type { CmsContentService } from '../services/cms/content.js'
import type { CouponService } from '../services/cms/coupons.js'
import type { SubscriptionService } from '../services/subscriptions.js'

/**
 * In-process periodic jobs. A MySQL advisory lock makes each run exclusive,
 * so running several backend replicas is safe.
 */
export function startJobs(deps: {
  db: Kysely<Database>
  subscriptions: SubscriptionService
  content: CmsContentService
  coupons: CouponService
  logger: Logger
  reconcileIntervalMinutes: number
}): () => void {
  const log = deps.logger.child({ component: 'jobs' })
  let running = false

  async function reconcileOnce() {
    if (running) return
    running = true
    try {
      await deps.db.connection().execute(async (conn) => {
        const lock = await sql<{ ok: number | null }>`SELECT GET_LOCK('loikmon_reconcile', 0) AS ok`.execute(conn)
        if (lock.rows[0]?.ok !== 1) return
        try {
          const started = Date.now()
          const result = await deps.subscriptions.reconcile()
          const expired = await deps.subscriptions.expireLapsed()
          // CMS housekeeping rides the same lock: scheduled content goes live
          // and campaigns past their end date stop being redeemable.
          const published = await deps.content.publishDue()
          const couponsExpired = await deps.coupons.expireDue()
          log.info(
            { ...result, expired, published, coupons_expired: couponsExpired, duration_ms: Date.now() - started },
            'scheduled maintenance finished',
          )
        } finally {
          await sql`SELECT RELEASE_LOCK('loikmon_reconcile')`.execute(conn)
        }
      })
    } catch (err) {
      log.error({ err }, 'subscription reconciliation crashed')
    } finally {
      running = false
    }
  }

  const first = setTimeout(reconcileOnce, 60_000)
  const interval = setInterval(reconcileOnce, deps.reconcileIntervalMinutes * 60_000)
  first.unref()
  interval.unref()
  log.info({ every_minutes: deps.reconcileIntervalMinutes }, 'background jobs scheduled')

  return () => {
    clearTimeout(first)
    clearInterval(interval)
  }
}
