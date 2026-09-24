import type { StoreEnvironment, SubscriptionStatus } from '../db/types.js'

/**
 * Store-agnostic view of a subscription as reported by Apple or Google.
 * Both store adapters normalise into this shape; the subscription service
 * never deals with store-specific payloads.
 */
export interface StoreSubscriptionSnapshot {
  platform: 'app_store' | 'google_play'
  /** Apple originalTransactionId / Google purchaseToken. Stable across renewals. */
  storeSubscriptionId: string
  productId: string
  /** Google base plan id; null on Apple. */
  basePlanId: string | null
  status: SubscriptionStatus
  autoRenew: boolean
  environment: StoreEnvironment
  startedAt: Date | null
  expiresAt: Date | null
  graceExpiresAt: Date | null
  canceledAt: Date | null
  revokedAt: Date | null
  latestTransactionId: string | null
  /** Google: token of the subscription this one replaced (upgrade/downgrade/resubscribe). */
  linkedPurchaseToken: string | null
  /** Apple appAccountToken / Google obfuscatedExternalAccountId — our user id when set by the app. */
  accountToken: string | null
  /** Google: purchase must be acknowledged within 3 days or it is refunded. */
  needsAcknowledgement: boolean
  raw: unknown
}

export interface StoreNotification {
  platform: 'app_store' | 'google_play'
  /** Unique id used for idempotency. */
  eventId: string
  type: string
  subtype: string | null
  /** Latest state of the affected subscription, when the notification concerns one. */
  snapshot: StoreSubscriptionSnapshot | null
  /** Google voided purchase (refund/chargeback): token to revoke. */
  revokedPurchaseToken?: string
  payload: unknown
}

/** Decode the payload of a compact JWS without verifying it (used only to pick a verifier). */
export function peekJwsPayload(jws: string): Record<string, unknown> | null {
  const parts = jws.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const value = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const msToDate = (value: number | string | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? new Date(n) : null
}
