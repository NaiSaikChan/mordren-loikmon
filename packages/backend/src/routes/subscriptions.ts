import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth } from '../middleware/auth.js'
import { sensitiveLimiter } from '../middleware/rateLimit.js'
import { PLAN_LIST, type PlanCode } from '../domain/plans.js'
import { resolveEntitlement, verifyAndPersist } from '../services/subscriptionService.js'
import { listUserSubscriptions } from '../repositories/subscriptionRepository.js'
import { createCheckoutSession } from '../services/payments/stripe.js'

const router = Router()

// GET /api/subscriptions/plans — public plan catalogue for all clients.
router.get('/plans', (_req, res) => {
  res.json({
    plans: PLAN_LIST.map((p) => ({
      code: p.code,
      name: p.name,
      priceUsd: p.priceUsd,
      durationDays: p.durationDays,
      storeProductIds: { android: p.storeProductIds.android, ios: p.storeProductIds.ios },
    })),
  })
})

// GET /api/subscriptions/me — current entitlement + history.
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [entitlement, history] = await Promise.all([
      resolveEntitlement(req.user!.id),
      listUserSubscriptions(req.user!.id),
    ])
    res.json({ entitlement, subscriptions: history })
  }),
)

// POST /api/subscriptions/verify — mobile clients submit a native purchase.
const verifySchema = z.object({
  platform: z.enum(['ios', 'android']),
  productId: z.string().optional(),
  purchaseToken: z.string().optional(),
  transactionId: z.string().optional(),
  receipt: z.string().optional(),
})

router.post(
  '/verify',
  requireAuth,
  sensitiveLimiter,
  asyncHandler(async (req, res) => {
    const input = verifySchema.parse(req.body)
    const entitlement = await verifyAndPersist(req.user!.id, input)
    res.json({ entitlement })
  }),
)

// POST /api/subscriptions/checkout — web (Stripe) checkout session.
const checkoutSchema = z.object({
  planCode: z.enum(['monthly', 'quarterly', 'semiannual', 'yearly']),
})

router.post(
  '/checkout',
  requireAuth,
  sensitiveLimiter,
  asyncHandler(async (req, res) => {
    const { planCode } = checkoutSchema.parse(req.body)
    const session = await createCheckoutSession({
      userId: req.user!.id,
      email: req.user!.email,
      planCode: planCode as PlanCode,
    })
    res.json(session)
  }),
)

export default router
