import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../context.js'
import { parse } from '../validate.js'

/**
 * Store server-to-server notifications.
 *
 * Both stores retry on non-2xx responses, so a 5xx is returned only for
 * transient failures (database/store outage); duplicates and notifications we
 * intentionally ignore still get 200.
 *
 *  - Apple:  App Store Connect → App Information → App Store Server Notifications (Version 2)
 *            → https://api.loikmon.org/api/v1/webhooks/apple
 *  - Google: Play Console → Monetization setup → Real-time developer notifications
 *            → Pub/Sub topic with a push subscription to
 *            https://api.loikmon.org/api/v1/webhooks/google (OIDC auth enabled)
 */
export function webhooksRouter(ctx: AppContext) {
  const router = Router()

  router.post('/apple', async (req, res) => {
    const { signedPayload } = parse(z.object({ signedPayload: z.string().min(20) }), req.body)
    const outcome = await ctx.services.subscriptions.handleAppleNotification(signedPayload)
    res.json({ status: 'ok', outcome })
  })

  router.post('/google', async (req, res) => {
    const outcome = await ctx.services.subscriptions.handleGoogleNotification(
      req.body,
      { authorization: req.headers.authorization },
      { token: req.query.token },
    )
    res.json({ status: 'ok', outcome })
  })

  return router
}
