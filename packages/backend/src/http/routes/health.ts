import { Router } from 'express'
import type { AppContext } from '../context.js'

const startedAt = new Date()

/**
 * - GET /health        liveness: the process is up (used by the Docker healthcheck).
 * - GET /health/ready  readiness: database and storage respond (for monitoring / deploy checks).
 */
export function healthRouter(ctx: AppContext) {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json({ status: 'ok', uptime_seconds: Math.round(process.uptime()), started_at: startedAt.toISOString() })
  })

  router.get('/ready', async (_req, res) => {
    const checks: Record<string, { ok: boolean; latency_ms: number; error?: string }> = {}
    await Promise.all(
      Object.entries(ctx.healthChecks).map(async ([name, check]) => {
        const start = performance.now()
        try {
          await Promise.race([
            check(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timed out after 3s')), 3000).unref()),
          ])
          checks[name] = { ok: true, latency_ms: Math.round(performance.now() - start) }
        } catch (err) {
          checks[name] = { ok: false, latency_ms: Math.round(performance.now() - start), error: (err as Error).message }
        }
      }),
    )
    const ok = Object.values(checks).every((c) => c.ok)
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      checks,
      integrations: {
        app_store: Boolean(ctx.apple),
        google_play: Boolean(ctx.google),
        smtp: Boolean(ctx.config.mail.smtp),
        legacy_login_migration: Boolean(ctx.legacyAuth),
      },
    })
  })

  return router
}
