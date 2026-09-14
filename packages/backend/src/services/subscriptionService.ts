import { computeExpiry, getPlan } from '../domain/plans.js'
import {
  getActiveSubscription,
  recordPaymentEvent,
  upsertSubscription,
} from '../repositories/subscriptionRepository.js'
import { verifyGooglePlay } from './payments/googlePlay.js'
import { verifyAppleReceipt, verifyAppleTransaction } from './payments/apple.js'
import type { VerifiedPurchase, VerifyRequest } from './payments/types.js'
import type { Entitlement } from '../types/index.js'
import { PaymentError, ValidationError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/**
 * Verify a client-supplied purchase with the correct store, persist it, and
 * return the resulting entitlement. This is called by the mobile clients after
 * a successful native purchase (Play Billing / StoreKit via Expo IAP).
 */
export async function verifyAndPersist(userId: string, req: VerifyRequest): Promise<Entitlement> {
  let verified: VerifiedPurchase

  if (req.platform === 'android') {
    if (!req.productId || !req.purchaseToken) {
      throw new ValidationError('Android verification requires productId and purchaseToken')
    }
    verified = await verifyGooglePlay(req.productId, req.purchaseToken)
  } else if (req.platform === 'ios') {
    if (req.transactionId && req.transactionId.split('.').length === 3) {
      // StoreKit2 JWS
      verified = await verifyAppleTransaction(req.transactionId)
    } else if (req.receipt) {
      verified = await verifyAppleReceipt(req.receipt)
    } else {
      throw new ValidationError('iOS verification requires a receipt or StoreKit2 transaction')
    }
  } else {
    throw new ValidationError('Web subscriptions are created via Stripe Checkout, not verify')
  }

  // Defensive: if the store did not supply an expiry, derive from plan length.
  const plan = getPlan(verified.planCode)
  const expiresAt =
    verified.expiresAt ?? (plan ? computeExpiry(plan, verified.startedAt ?? new Date()) : null)

  const subscriptionId = await upsertSubscription({
    userId,
    planCode: verified.planCode,
    provider: verified.provider,
    status: verified.status,
    providerTxnId: verified.providerTxnId,
    purchaseToken: verified.purchaseToken,
    originalTxnId: verified.originalTxnId,
    environment: verified.environment,
    autoRenewing: verified.autoRenewing,
    startedAt: verified.startedAt,
    expiresAt,
    latestReceipt: verified.rawReceipt,
  })

  await recordPaymentEvent({
    subscriptionId,
    userId,
    provider: verified.provider,
    eventType: 'verify',
    providerEventId: `${verified.provider}:${verified.providerTxnId}`,
    payload: { planCode: verified.planCode, status: verified.status },
  })

  logger.info(
    { userId, provider: verified.provider, plan: verified.planCode, status: verified.status },
    'subscription verified & persisted',
  )

  return {
    active: verified.status === 'active' || verified.status === 'grace_period',
    planCode: verified.planCode,
    status: verified.status,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    provider: verified.provider,
  }
}

/** Resolve the current entitlement for a user (used by access middleware). */
export async function resolveEntitlement(userId: string): Promise<Entitlement> {
  const sub = await getActiveSubscription(userId)
  if (!sub) {
    return { active: false, planCode: null, status: null, expiresAt: null, provider: null }
  }
  return {
    active: true,
    planCode: sub.plan_code,
    status: sub.status,
    expiresAt: sub.expires_at ? new Date(sub.expires_at).toISOString() : null,
    provider: sub.provider,
  }
}
