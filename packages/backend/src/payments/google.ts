import { timingSafeEqual } from 'node:crypto'
import { JWT, OAuth2Client } from 'google-auth-library'
import type { AppConfig } from '../config/env.js'
import type { SubscriptionStatus } from '../db/types.js'
import { AppError, errors } from '../lib/errors.js'
import type { Logger } from '../lib/logger.js'
import type { StoreNotification, StoreSubscriptionSnapshot } from './types.js'

/**
 * Google Play Billing verification.
 *
 * - Purchases are verified with the Play Developer API
 *   `purchases.subscriptionsv2.get` using a service account.
 * - New purchases are acknowledged server-side (Play refunds purchases that
 *   stay unacknowledged for 3 days, even if the app crashed before finishing).
 * - Real-time developer notifications arrive through a Pub/Sub push
 *   subscription, authenticated with Google-signed OIDC tokens.
 */

const PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'

/** Subset of SubscriptionPurchaseV2 used by the backend. */
export interface SubscriptionPurchaseV2 {
  subscriptionState?: string
  startTime?: string
  latestOrderId?: string
  linkedPurchaseToken?: string
  testPurchase?: Record<string, never>
  acknowledgementState?: string
  canceledStateContext?: Record<string, unknown>
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string; externalAccountId?: string }
  lineItems?: Array<{
    productId?: string
    expiryTime?: string
    latestSuccessfulOrderId?: string
    autoRenewingPlan?: { autoRenewEnabled?: boolean }
    offerDetails?: { basePlanId?: string; offerId?: string }
  }>
}

export interface GooglePlayApi {
  getSubscription(purchaseToken: string): Promise<SubscriptionPurchaseV2>
  acknowledge(productId: string, purchaseToken: string): Promise<void>
}

export interface PushTokenVerifier {
  verify(idToken: string, audience: string): Promise<{ email?: string; email_verified?: boolean }>
}

export interface GooglePlayOptions {
  packageName: string
  api: GooglePlayApi
  pubsub: { audience?: string; serviceAccount?: string; verificationToken?: string }
  pushVerifier?: PushTokenVerifier
  logger: Logger
  now?: () => Date
}

export class GooglePlayService {
  constructor(private readonly options: GooglePlayOptions) {}

  static fromConfig(config: AppConfig, logger: Logger): GooglePlayService | null {
    const google = config.google
    if (!google) return null
    return new GooglePlayService({
      packageName: google.packageName,
      api: createPlayApi(google.packageName, google.serviceAccount),
      pubsub: google.pubsub,
      pushVerifier: createPushVerifier(),
      logger,
    })
  }

  get packageName(): string {
    return this.options.packageName
  }

  private now(): Date {
    return this.options.now?.() ?? new Date()
  }

  /** Verify a purchase token sent by the app. `productId` must match the purchased subscription. */
  async verifyPurchase(productId: string, purchaseToken: string): Promise<StoreSubscriptionSnapshot> {
    const purchase = await this.options.api.getSubscription(purchaseToken)
    const snapshot = snapshotFromGoogle(purchaseToken, purchase, this.now())
    if (snapshot.productId !== productId) {
      throw errors.purchaseInvalid('Purchase token does not belong to the given product')
    }
    return snapshot
  }

  async fetchLatest(purchaseToken: string): Promise<StoreSubscriptionSnapshot | null> {
    try {
      const purchase = await this.options.api.getSubscription(purchaseToken)
      return snapshotFromGoogle(purchaseToken, purchase, this.now())
    } catch (err) {
      if (err instanceof AppError && err.code === 'PURCHASE_INVALID') return null
      throw err
    }
  }

  async acknowledge(snapshot: StoreSubscriptionSnapshot): Promise<void> {
    if (!snapshot.needsAcknowledgement) return
    try {
      await this.options.api.acknowledge(snapshot.productId, snapshot.storeSubscriptionId)
    } catch (err) {
      // The app also acknowledges via finishTransaction; log and let the
      // reconciliation job retry rather than failing the user's request.
      this.options.logger.error({ err, productId: snapshot.productId }, 'Google Play acknowledge failed')
    }
  }

  /**
   * Authenticate a Pub/Sub push request. Prefers OIDC (Google-signed JWT in
   * the Authorization header); falls back to a shared `?token=` secret.
   */
  async authenticatePush(headers: { authorization?: string }, query: { token?: unknown }): Promise<void> {
    const { audience, serviceAccount, verificationToken } = this.options.pubsub
    if (audience) {
      const header = headers.authorization ?? ''
      const idToken = header.startsWith('Bearer ') ? header.slice(7) : ''
      if (!idToken || !this.options.pushVerifier) throw errors.webhookUnauthorized('Missing Pub/Sub OIDC token')
      let claims: { email?: string; email_verified?: boolean }
      try {
        claims = await this.options.pushVerifier.verify(idToken, audience)
      } catch (err) {
        throw errors.webhookUnauthorized(`Invalid Pub/Sub OIDC token: ${(err as Error).message}`)
      }
      if (serviceAccount && (claims.email !== serviceAccount || claims.email_verified !== true)) {
        throw errors.webhookUnauthorized('Pub/Sub token issued for an unexpected service account')
      }
      return
    }
    if (verificationToken) {
      const provided = typeof query.token === 'string' ? query.token : ''
      if (!safeEqual(provided, verificationToken)) throw errors.webhookUnauthorized('Invalid verification token')
      return
    }
    throw errors.webhookUnauthorized('Play notification authentication is not configured')
  }

  /** Parse a Pub/Sub push body into a normalised notification, fetching the latest purchase state. */
  async decodeNotification(body: unknown): Promise<StoreNotification> {
    const envelope = parsePushEnvelope(body)
    const rtdn = envelope.data
    if (rtdn.packageName && rtdn.packageName !== this.options.packageName) {
      throw errors.badRequest(`Notification for unexpected package ${rtdn.packageName}`)
    }
    const base = { platform: 'google_play' as const, eventId: envelope.messageId, payload: rtdn }

    if (rtdn.testNotification) return { ...base, type: 'TEST', subtype: null, snapshot: null }

    if (rtdn.voidedPurchaseNotification?.purchaseToken) {
      return {
        ...base,
        type: 'VOIDED_PURCHASE',
        subtype: String(rtdn.voidedPurchaseNotification.refundType ?? ''),
        snapshot: null,
        revokedPurchaseToken: rtdn.voidedPurchaseNotification.purchaseToken,
      }
    }

    const sub = rtdn.subscriptionNotification
    if (sub?.purchaseToken) {
      const snapshot = await this.fetchLatest(sub.purchaseToken)
      return {
        ...base,
        type: GOOGLE_NOTIFICATION_TYPES[sub.notificationType ?? -1] ?? `SUBSCRIPTION_${sub.notificationType}`,
        subtype: null,
        snapshot,
      }
    }

    return { ...base, type: rtdn.oneTimeProductNotification ? 'ONE_TIME_PRODUCT' : 'UNKNOWN', subtype: null, snapshot: null }
  }
}

export const GOOGLE_NOTIFICATION_TYPES: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
  17: 'SUBSCRIPTION_ITEMS_CHANGED',
  18: 'SUBSCRIPTION_CANCELLATION_SCHEDULED',
  19: 'SUBSCRIPTION_PRICE_CHANGE_UPDATED',
  20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
  22: 'SUBSCRIPTION_PRICE_STEP_UP_CONSENT_UPDATED',
}

interface RtdnPayload {
  version?: string
  packageName?: string
  eventTimeMillis?: string
  subscriptionNotification?: { notificationType?: number; purchaseToken?: string; subscriptionId?: string }
  voidedPurchaseNotification?: { purchaseToken?: string; orderId?: string; refundType?: number }
  oneTimeProductNotification?: Record<string, unknown>
  testNotification?: Record<string, unknown>
}

export function parsePushEnvelope(body: unknown): { messageId: string; data: RtdnPayload } {
  const message = (body as { message?: { data?: unknown; messageId?: unknown; message_id?: unknown } } | null)?.message
  const messageId = message?.messageId ?? message?.message_id
  if (!message || typeof message.data !== 'string' || typeof messageId !== 'string') {
    throw errors.badRequest('Invalid Pub/Sub push message')
  }
  try {
    return { messageId, data: JSON.parse(Buffer.from(message.data, 'base64').toString('utf8')) as RtdnPayload }
  } catch {
    throw errors.badRequest('Pub/Sub message data is not valid base64 JSON')
  }
}

const GOOGLE_STATES: Record<string, SubscriptionStatus> = {
  SUBSCRIPTION_STATE_ACTIVE: 'active',
  SUBSCRIPTION_STATE_CANCELED: 'canceled',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace_period',
  SUBSCRIPTION_STATE_ON_HOLD: 'billing_retry',
  SUBSCRIPTION_STATE_PAUSED: 'paused',
  SUBSCRIPTION_STATE_PENDING: 'pending',
  SUBSCRIPTION_STATE_EXPIRED: 'expired',
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
}

/** Normalise a SubscriptionPurchaseV2 resource. Pure; exported for tests. */
export function snapshotFromGoogle(
  purchaseToken: string,
  purchase: SubscriptionPurchaseV2,
  now: Date,
): StoreSubscriptionSnapshot {
  const item = purchase.lineItems?.[0]
  if (!item?.productId) throw errors.purchaseInvalid('Play subscription has no line items')

  const expiresAt = item.expiryTime ? new Date(item.expiryTime) : null
  let status = GOOGLE_STATES[purchase.subscriptionState ?? ''] ?? 'pending'
  // A canceled subscription whose paid period has ended is simply expired.
  if (status === 'canceled' && (!expiresAt || expiresAt <= now)) status = 'expired'

  return {
    platform: 'google_play',
    storeSubscriptionId: purchaseToken,
    productId: item.productId,
    basePlanId: item.offerDetails?.basePlanId ?? null,
    status,
    autoRenew: item.autoRenewingPlan?.autoRenewEnabled === true && (status === 'active' || status === 'grace_period'),
    environment: purchase.testPurchase ? 'sandbox' : 'production',
    startedAt: purchase.startTime ? new Date(purchase.startTime) : null,
    expiresAt,
    graceExpiresAt: status === 'grace_period' ? expiresAt : null,
    canceledAt: purchase.canceledStateContext ? now : null,
    revokedAt: null,
    latestTransactionId: item.latestSuccessfulOrderId ?? purchase.latestOrderId ?? null,
    linkedPurchaseToken: purchase.linkedPurchaseToken ?? null,
    accountToken: purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    needsAcknowledgement: purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && status === 'active',
    raw: purchase,
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function createPlayApi(packageName: string, serviceAccount: Record<string, unknown>): GooglePlayApi {
  const client = new JWT({
    email: serviceAccount.client_email as string,
    key: serviceAccount.private_key as string,
    scopes: [SCOPE],
  })
  const base = `${PUBLISHER}/${encodeURIComponent(packageName)}/purchases`

  const call = async <T>(url: string, method: 'GET' | 'POST', data?: unknown): Promise<T> => {
    try {
      const res = await client.request<T>({ url, method, data, timeout: 15_000, retry: true })
      return res.data
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 400 || status === 404 || status === 410) {
        throw errors.purchaseInvalid('Google Play does not recognise this purchase token', err)
      }
      throw errors.storeUnavailable('Google Play', err)
    }
  }

  return {
    getSubscription: (token) => call<SubscriptionPurchaseV2>(`${base}/subscriptionsv2/tokens/${encodeURIComponent(token)}`, 'GET'),
    acknowledge: async (productId, token) => {
      await call(
        `${base}/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`,
        'POST',
        {},
      )
    },
  }
}

function createPushVerifier(): PushTokenVerifier {
  const client = new OAuth2Client()
  return {
    async verify(idToken, audience) {
      const ticket = await client.verifyIdToken({ idToken, audience })
      const payload = ticket.getPayload()
      return { email: payload?.email, email_verified: payload?.email_verified }
    },
  }
}
