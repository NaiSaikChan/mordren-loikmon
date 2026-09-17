import pino from 'pino'
import { GooglePlayService, type GooglePlayApi, type SubscriptionPurchaseV2 } from '../../src/payments/google.js'
import { errors } from '../../src/lib/errors.js'
import { allVariantKeys } from '@loikmon/media-standards'
import { buildObjectKey, type AssetKind, type PresignedUpload, type StorageService } from '../../src/storage/storage.js'

export const silentLogger = pino({ level: 'silent' })

/** Storage double: deterministic URLs, objects kept in memory. */
export class FakeStorage implements StorageService {
  readonly objects = new Map<string, { size: number; contentType: string; body?: Buffer }>()
  readonly removed: string[] = []

  isAbsoluteUrl(value: string) {
    return /^https?:\/\//i.test(value)
  }
  publicUrl(key: string | null | undefined) {
    if (!key) return null
    return this.isAbsoluteUrl(key) ? key : `https://storage.test/public/${key}`
  }
  async signedUrl(key: string, options: { ttlSeconds?: number } = {}) {
    const expiresAt = new Date(Date.now() + (options.ttlSeconds ?? 3600) * 1000)
    return { url: this.isAbsoluteUrl(key) ? key : `https://storage.test/private/${key}?signature=test`, expiresAt }
  }
  async presignUpload(kind: AssetKind, contentType: string, filename?: string): Promise<PresignedUpload> {
    const key = buildObjectKey(kind, filename)
    return { key, url: `https://storage.test/upload/${key}`, method: 'PUT', headers: { 'Content-Type': contentType }, expires_at: new Date().toISOString() }
  }
  async putObject(kind: AssetKind, _body: unknown, size: number, contentType: string, filename?: string) {
    const key = buildObjectKey(kind, filename)
    this.objects.set(key, { size, contentType })
    return key
  }
  async putObjectAt(key: string, body: unknown, size: number, contentType: string) {
    this.objects.set(key, { size, contentType, body: Buffer.isBuffer(body) ? body : undefined })
  }
  async statObject(key: string) {
    const object = this.objects.get(key)
    return object ? { size: object.size, contentType: object.contentType } : null
  }
  async removeObject(key: string) {
    this.removed.push(key)
    this.objects.delete(key)
    for (const variant of allVariantKeys(key)) this.objects.delete(variant)
  }
  async ensureBuckets() {}
  async ping() {}
}

/** In-memory Play Developer API. */
export class FakePlayApi implements GooglePlayApi {
  readonly purchases = new Map<string, SubscriptionPurchaseV2>()
  readonly acknowledged: string[] = []
  failNext: 'unavailable' | null = null

  async getSubscription(token: string) {
    if (this.failNext) {
      this.failNext = null
      throw errors.storeUnavailable('Google Play')
    }
    const purchase = this.purchases.get(token)
    if (!purchase) throw errors.purchaseInvalid('Google Play does not recognise this purchase token')
    return structuredClone(purchase)
  }

  async acknowledge(_productId: string, token: string) {
    this.acknowledged.push(token)
    const purchase = this.purchases.get(token)
    if (purchase) purchase.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
  }
}

export const PLAY_PACKAGE = 'org.loikmon.mobile'
export const PUBSUB_AUDIENCE = 'https://api.loikmon.test/api/v1/webhooks/google'
export const PUBSUB_SERVICE_ACCOUNT = 'play-rtdn@loikmon.iam.gserviceaccount.com'

export function playPurchase(overrides: Partial<SubscriptionPurchaseV2> & { expiry?: Date; basePlanId?: string; accountId?: string } = {}): SubscriptionPurchaseV2 {
  const { expiry, basePlanId, accountId, ...rest } = overrides
  return {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    startTime: new Date(Date.now() - 60_000).toISOString(),
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    externalAccountIdentifiers: accountId ? { obfuscatedExternalAccountId: accountId } : undefined,
    lineItems: [
      {
        productId: 'loikmon_premium',
        expiryTime: (expiry ?? new Date(Date.now() + 30 * 86400_000)).toISOString(),
        latestSuccessfulOrderId: 'GPA.1234-5678-9012-34567',
        autoRenewingPlan: { autoRenewEnabled: true },
        offerDetails: { basePlanId: basePlanId ?? 'monthly' },
      },
    ],
    ...rest,
  }
}

export function createTestGoogleService(api: FakePlayApi, options: { now?: () => Date } = {}) {
  return new GooglePlayService({
    packageName: PLAY_PACKAGE,
    api,
    pubsub: { audience: PUBSUB_AUDIENCE, serviceAccount: PUBSUB_SERVICE_ACCOUNT },
    pushVerifier: {
      // Stand-in for Google's OIDC verification: "valid:<email>" tokens pass.
      async verify(idToken, audience) {
        if (audience !== PUBSUB_AUDIENCE || !idToken.startsWith('valid:')) throw new Error('invalid token')
        return { email: idToken.slice('valid:'.length), email_verified: true }
      },
    },
    logger: silentLogger,
    now: options.now,
  })
}

export function pushBody(data: Record<string, unknown>, messageId: string = crypto.randomUUID()) {
  return {
    message: { data: Buffer.from(JSON.stringify({ version: '1.0', packageName: PLAY_PACKAGE, eventTimeMillis: String(Date.now()), ...data })).toString('base64'), messageId },
    subscription: 'projects/loikmon/subscriptions/play-rtdn-push',
  }
}
