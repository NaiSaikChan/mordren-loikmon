import { describe, expect, it } from 'vitest'
import { AppError } from '../../src/lib/errors.js'
import { GooglePlayService, parsePushEnvelope, snapshotFromGoogle } from '../../src/payments/google.js'
import { createTestGoogleService, FakePlayApi, playPurchase, PUBSUB_SERVICE_ACCOUNT, pushBody, silentLogger } from '../helpers/fakes.js'

const now = new Date()

async function codeOf(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  return err instanceof AppError ? err.code : err
}

describe('snapshotFromGoogle', () => {
  it.each([
    ['SUBSCRIPTION_STATE_ACTIVE', 'active'],
    ['SUBSCRIPTION_STATE_CANCELED', 'canceled'],
    ['SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'grace_period'],
    ['SUBSCRIPTION_STATE_ON_HOLD', 'billing_retry'],
    ['SUBSCRIPTION_STATE_PAUSED', 'paused'],
    ['SUBSCRIPTION_STATE_PENDING', 'pending'],
    ['SUBSCRIPTION_STATE_EXPIRED', 'expired'],
    ['SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED', 'expired'],
  ])('%s → %s', (state, expected) => {
    expect(snapshotFromGoogle('tok', playPurchase({ subscriptionState: state }), now).status).toBe(expected)
  })

  it('treats a canceled subscription past its paid period as expired', () => {
    const purchase = playPurchase({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', expiry: new Date(Date.now() - 1000) })
    expect(snapshotFromGoogle('tok', purchase, now).status).toBe('expired')
  })

  it('extracts base plan, account token, test flag and acknowledgement need', () => {
    const snapshot = snapshotFromGoogle('tok', playPurchase({ basePlanId: 'yearly', accountId: 'user-uuid', testPurchase: {} }), now)
    expect(snapshot).toMatchObject({
      storeSubscriptionId: 'tok',
      productId: 'loikmon_premium',
      basePlanId: 'yearly',
      accountToken: 'user-uuid',
      environment: 'sandbox',
      autoRenew: true,
      needsAcknowledgement: true,
    })
  })

  it('rejects purchases without line items', () => {
    expect(() => snapshotFromGoogle('tok', { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' }, now)).toThrow(AppError)
  })
})

describe('GooglePlayService', () => {
  it('verifies a purchase and refuses a token used for a different product', async () => {
    const api = new FakePlayApi()
    api.purchases.set('tok-1', playPurchase())
    const google = createTestGoogleService(api)
    await expect(google.verifyPurchase('loikmon_premium', 'tok-1')).resolves.toMatchObject({ status: 'active' })
    expect(await codeOf(google.verifyPurchase('other_product', 'tok-1'))).toBe('PURCHASE_INVALID')
    expect(await codeOf(google.verifyPurchase('loikmon_premium', 'unknown'))).toBe('PURCHASE_INVALID')
  })

  it('acknowledges only when needed and never throws on failure', async () => {
    const api = new FakePlayApi()
    api.purchases.set('tok-1', playPurchase())
    const google = createTestGoogleService(api)
    const snapshot = await google.verifyPurchase('loikmon_premium', 'tok-1')
    await google.acknowledge(snapshot)
    await google.acknowledge({ ...snapshot, needsAcknowledgement: false })
    expect(api.acknowledged).toEqual(['tok-1'])

    api.acknowledge = async () => {
      throw new Error('boom')
    }
    await expect(google.acknowledge(snapshot)).resolves.toBeUndefined()
  })

  describe('push authentication', () => {
    const google = createTestGoogleService(new FakePlayApi())

    it('accepts a valid OIDC token from the configured service account', async () => {
      await expect(google.authenticatePush({ authorization: `Bearer valid:${PUBSUB_SERVICE_ACCOUNT}` }, {})).resolves.toBeUndefined()
    })
    it('rejects missing, invalid or foreign tokens', async () => {
      expect(await codeOf(google.authenticatePush({}, {}))).toBe('WEBHOOK_UNAUTHORIZED')
      expect(await codeOf(google.authenticatePush({ authorization: 'Bearer forged' }, {}))).toBe('WEBHOOK_UNAUTHORIZED')
      expect(await codeOf(google.authenticatePush({ authorization: 'Bearer valid:attacker@evil.test' }, {}))).toBe('WEBHOOK_UNAUTHORIZED')
    })
    it('supports a shared verification token when OIDC is not configured', async () => {
      const tokenOnly = new GooglePlayService({ packageName: 'p', api: new FakePlayApi(), pubsub: { verificationToken: 's3cret' }, logger: silentLogger })
      await expect(tokenOnly.authenticatePush({}, { token: 's3cret' })).resolves.toBeUndefined()
      expect(await codeOf(tokenOnly.authenticatePush({}, { token: 'wrong' }))).toBe('WEBHOOK_UNAUTHORIZED')
      const unconfigured = new GooglePlayService({ packageName: 'p', api: new FakePlayApi(), pubsub: {}, logger: silentLogger })
      expect(await codeOf(unconfigured.authenticatePush({}, {}))).toBe('WEBHOOK_UNAUTHORIZED')
    })
  })

  describe('decodeNotification', () => {
    const api = new FakePlayApi()
    api.purchases.set('tok-1', playPurchase({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }))
    const google = createTestGoogleService(api)

    it('fetches the current state for subscription notifications', async () => {
      const n = await google.decodeNotification(pushBody({ subscriptionNotification: { notificationType: 3, purchaseToken: 'tok-1', subscriptionId: 'loikmon_premium' } }, 'msg-1'))
      expect(n).toMatchObject({ eventId: 'msg-1', type: 'SUBSCRIPTION_CANCELED' })
      expect(n.snapshot?.status).toBe('canceled')
    })
    it('maps voided purchases to revocations', async () => {
      const n = await google.decodeNotification(pushBody({ voidedPurchaseNotification: { purchaseToken: 'tok-1', orderId: 'GPA.1', refundType: 1 } }))
      expect(n).toMatchObject({ type: 'VOIDED_PURCHASE', revokedPurchaseToken: 'tok-1', snapshot: null })
    })
    it('handles test notifications and unknown tokens without failing', async () => {
      expect((await google.decodeNotification(pushBody({ testNotification: { version: '1.0' } }))).type).toBe('TEST')
      const unknown = await google.decodeNotification(pushBody({ subscriptionNotification: { notificationType: 2, purchaseToken: 'nope' } }))
      expect(unknown.snapshot).toBeNull()
    })
    it('rejects notifications for another package and malformed bodies', async () => {
      expect(await codeOf(google.decodeNotification(pushBody({ packageName: 'com.other', testNotification: {} })))).toBe('BAD_REQUEST')
      expect(() => parsePushEnvelope({ message: { data: 123 } })).toThrow(AppError)
      expect(() => parsePushEnvelope({ message: { data: 'not base64 json', messageId: '1' } })).toThrow(AppError)
    })
  })
})
