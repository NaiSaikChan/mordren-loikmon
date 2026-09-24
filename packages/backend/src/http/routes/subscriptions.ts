import { Router } from 'express'
import { z } from 'zod'
import { serializePlans } from '../../domain/plans.js'
import type { VerifyPurchaseInput } from '../../services/subscriptions.js'
import type { AppContext } from '../context.js'
import { getEntitlement, requireAuth, requireUser } from '../middleware/auth.js'
import type { createRateLimiters } from '../middleware/rateLimit.js'
import { parse } from '../validate.js'

export const VerifyBody = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('ios'),
    /** expo-iap `purchase.purchaseToken` on iOS: the StoreKit 2 JWS representation. */
    transaction_jws: z.string().min(20).max(20_000),
  }),
  z.object({
    platform: z.literal('android'),
    product_id: z.string().min(1).max(128),
    /** expo-iap `purchase.purchaseToken` on Android. */
    purchase_token: z.string().min(10).max(1024),
  }),
])

const RestoreBody = z.object({ purchases: z.array(VerifyBody).min(1).max(20) })

/**
 * `/api/v1/subscriptions`
 *
 * Purchases happen natively (Google Play Billing / StoreKit via expo-iap);
 * the app then sends the proof here. The server — never the client — decides
 * whether the account is entitled.
 */
export function subscriptionsRouter(ctx: AppContext, limiters: ReturnType<typeof createRateLimiters>) {
  const router = Router()
  const service = ctx.services.subscriptions

  router.get('/plans', async (_req, res) => {
    const plans = await service.listPlans()
    res.set('Cache-Control', 'public, max-age=300')
    res.json({
      status: 'ok',
      plans: serializePlans(plans, (key) => ctx.storage.publicUrl(key)),
      // Web has no native billing: subscriptions are bought in the apps and apply to the account everywhere.
      platforms: { ios: Boolean(ctx.apple), android: Boolean(ctx.google), web: false },
    })
  })

  router.get('/me', requireAuth, async (req, res) => {
    const user = requireUser(req)
    const [entitlement, subscriptions] = await Promise.all([getEntitlement(ctx, req), service.listUserSubscriptions(user.id)])
    res.set('Cache-Control', 'private, no-store')
    res.json({
      status: 'ok',
      entitlement,
      account_token: user.id,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        plan_code: s.plan_code,
        platform: s.platform,
        product_id: s.product_id,
        status: s.status,
        auto_renew: s.auto_renew,
        environment: s.environment,
        started_at: s.started_at,
        expires_at: s.expires_at,
        updated_at: s.updated_at,
      })),
      manage_urls: {
        app_store: 'https://apps.apple.com/account/subscriptions',
        google_play: ctx.google
          ? `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(ctx.google.packageName)}`
          : 'https://play.google.com/store/account/subscriptions',
      },
    })
  })

  router.post('/verify', requireAuth, limiters.purchases, async (req, res) => {
    const body = parse(VerifyBody, req.body) as VerifyPurchaseInput
    const user = requireUser(req)
    const result = await service.verifyPurchase({ id: user.id, role: user.role }, body)
    res.json({
      status: 'ok',
      entitlement: result.entitlement,
      subscription: {
        id: result.subscription.id,
        plan_code: result.subscription.plan_code,
        platform: result.subscription.platform,
        status: result.subscription.status,
        expires_at: result.subscription.expires_at,
        auto_renew: result.subscription.auto_renew,
      },
    })
  })

  router.post('/restore', requireAuth, limiters.purchases, async (req, res) => {
    const body = parse(RestoreBody, req.body)
    const user = requireUser(req)
    const result = await service.restorePurchases({ id: user.id, role: user.role }, body.purchases as VerifyPurchaseInput[])
    res.json({ status: 'ok', ...result })
  })

  return router
}
