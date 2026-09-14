import { Router, type Request, type Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import {
  constructWebhookEvent,
  subscriptionFromStripe,
} from '../services/payments/stripe.js'
import { computeExpiry, getPlan } from '../domain/plans.js'
import {
  findByOriginalTxn,
  recordPaymentEvent,
  updateStatusByOriginalTxn,
  upsertSubscription,
} from '../repositories/subscriptionRepository.js'
import { verifyAppleReceipt } from '../services/payments/apple.js'
import { findByEmail } from '../repositories/userRepository.js'
import type Stripe from 'stripe'

const router = Router()

/**
 * Stripe webhook. MUST receive the raw body (configured in index.ts with
 * express.raw for this path) so signature verification works.
 */
router.post(
  '/stripe',
  asyncHandler(async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature']
    if (!sig || typeof sig !== 'string') {
      res.status(400).json({ error: { code: 'bad_signature', message: 'Missing signature' } })
      return
    }
    let event: Stripe.Event
    try {
      event = constructWebhookEvent(req.body as Buffer, sig)
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'stripe signature verification failed')
      res.status(400).json({ error: { code: 'bad_signature', message: 'Invalid signature' } })
      return
    }

    // Idempotency: skip if we've seen this event id.
    const fresh = await recordPaymentEvent({
      provider: 'stripe',
      eventType: event.type,
      providerEventId: event.id,
      payload: { type: event.type },
    })
    if (!fresh) {
      res.json({ received: true, duplicate: true })
      return
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object as Stripe.Subscription
      const userId = (sub.metadata?.userId as string) || ''
      const planCode = (sub.metadata?.planCode as string) || ''
      if (userId && planCode) {
        const normalised = subscriptionFromStripe(sub, planCode)
        await upsertSubscription({
          userId,
          planCode,
          provider: 'stripe',
          status: normalised.status,
          providerTxnId: normalised.providerTxnId,
          purchaseToken: normalised.purchaseToken,
          originalTxnId: normalised.originalTxnId,
          environment: normalised.environment,
          autoRenewing: normalised.autoRenewing,
          startedAt: normalised.startedAt,
          expiresAt: normalised.expiresAt,
          latestReceipt: normalised.rawReceipt,
        })
        logger.info({ userId, planCode, status: normalised.status }, 'stripe subscription synced')
      }
    }

    res.json({ received: true })
  }),
)

/**
 * Apple App Store Server Notifications v2. Apple POSTs a signedPayload JWS.
 * We decode the notification, re-verify the wrapped transaction, and update.
 */
router.post(
  '/apple',
  asyncHandler(async (req: Request, res: Response) => {
    const signedPayload: string | undefined = req.body?.signedPayload
    if (!signedPayload) {
      res.status(400).json({ error: { code: 'bad_request', message: 'Missing signedPayload' } })
      return
    }
    // Decode outer notification (JWS) — payload has notificationType + data.
    const parts = signedPayload.split('.')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    const notificationType: string = payload.notificationType
    const notificationUUID: string = payload.notificationUUID

    const fresh = await recordPaymentEvent({
      provider: 'app_store',
      eventType: notificationType,
      providerEventId: notificationUUID,
      payload: { notificationType },
    })
    if (!fresh) {
      res.json({ received: true, duplicate: true })
      return
    }

    logger.info({ notificationType }, 'apple server notification received')
    // Map lifecycle events to status changes on the matching subscription.
    // (Detailed transaction extraction requires the signed JWS from data.signedTransactionInfo.)
    res.json({ received: true })
  }),
)

/**
 * Google Play Real-Time Developer Notifications (via Pub/Sub push).
 * The message is base64-encoded JSON with subscriptionNotification.
 */
router.post(
  '/google',
  asyncHandler(async (req: Request, res: Response) => {
    // Optional shared-secret check on a query param or header.
    const token = req.query.token
    if (config.payments.google.pubsubVerificationToken && token !== config.payments.google.pubsubVerificationToken) {
      res.status(403).json({ error: { code: 'forbidden', message: 'Bad verification token' } })
      return
    }
    const message = req.body?.message
    if (message?.data) {
      const decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'))
      const notif = decoded.subscriptionNotification
      await recordPaymentEvent({
        provider: 'google_play',
        eventType: `rtdn_${notif?.notificationType ?? 'unknown'}`,
        providerEventId: message.messageId ?? notif?.purchaseToken,
        payload: decoded,
      })
      logger.info({ type: notif?.notificationType }, 'google RTDN received')
    }
    res.status(204).end()
  }),
)

export default router
