import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { notificationPayload, renewalPayload, signJws, transactionPayload } from '../helpers/apple.js'
import { playPurchase, PUBSUB_SERVICE_ACCOUNT, pushBody } from '../helpers/fakes.js'
import { bearer, createTestApp, hasTestDatabase, registerUser, type TestApp } from '../helpers/testApp.js'

const DAY = 86400_000

describe.skipIf(!hasTestDatabase)('subscriptions (MySQL)', () => {
  let t: TestApp
  let paidBook: number
  const googlePush = (body: object) =>
    request(t.app).post('/api/v1/webhooks/google').set('Authorization', `Bearer valid:${PUBSUB_SERVICE_ACCOUNT}`).send(body)

  beforeAll(async () => {
    t = await createTestApp()
    const { token: admin } = await registerUser(t.app, 'admin@loikmon.test')
    const book = await request(t.app).post('/api/v1/admin/books').set(bearer(admin)).send({ title: 'Paid', epub_key: 'epub/t/paid.epub' })
    paidBook = book.body.item.id
  })
  afterAll(async () => t?.close())

  const canRead = async (token: string) => (await request(t.app).get(`/api/v1/books/${paidBook}/file`).set(bearer(token))).status

  it('publishes the four plans with store product ids', async () => {
    const res = await request(t.app).get('/api/v1/subscriptions/plans')
    expect(res.body.plans.map((p: { code: string; price: string }) => `${p.code}:${p.price}`)).toEqual([
      'monthly:4.00',
      'quarterly:10.00',
      'semiannual:20.00',
      'yearly:45.00',
    ])
    expect(res.body.platforms).toEqual({ ios: true, android: true, web: false })
  })

  describe('iOS (StoreKit 2)', () => {
    it('verifies a signed transaction and unlocks the whole catalogue', async () => {
      const { token, user } = await registerUser(t.app, 'ios@example.com')
      expect(await canRead(token)).toBe(403)

      const jws = signJws(transactionPayload({ originalTransactionId: 'ios-orig-1', transactionId: 'ios-tx-1', appAccountToken: user.id, productId: 'org.loikmon.mobile.premium.yearly' }))
      const res = await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(token)).send({ platform: 'ios', transaction_jws: jws })
      expect(res.status).toBe(200)
      expect(res.body.entitlement).toMatchObject({ active: true, source: 'subscription', subscription: { plan_code: 'yearly', platform: 'app_store', status: 'active' } })
      expect(await canRead(token)).toBe(200)

      const me = await request(t.app).get('/api/v1/subscriptions/me').set(bearer(token))
      expect(me.body).toMatchObject({ account_token: user.id, entitlement: { active: true } })
      expect(me.body.subscriptions).toHaveLength(1)

      // Re-verifying the same purchase (app relaunch) is idempotent.
      const again = await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(token)).send({ platform: 'ios', transaction_jws: jws })
      expect(again.status).toBe(200)
      expect((await request(t.app).get('/api/v1/subscriptions/me').set(bearer(token))).body.subscriptions).toHaveLength(1)
    })

    it('rejects forged transactions and bad payloads', async () => {
      const { token } = await registerUser(t.app, 'forger@example.com')
      const forged = await request(t.app)
        .post('/api/v1/subscriptions/verify')
        .set(bearer(token))
        .send({ platform: 'ios', transaction_jws: signJws(transactionPayload({ originalTransactionId: 'forged' }), { tamper: true }) })
      expect([forged.status, forged.body.code]).toEqual([422, 'PURCHASE_INVALID'])
      expect(await canRead(token)).toBe(403)

      const invalid = await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(token)).send({ platform: 'ios' })
      expect(invalid.body.code).toBe('VALIDATION_ERROR')
      expect((await request(t.app).post('/api/v1/subscriptions/verify').send({ platform: 'ios', transaction_jws: 'x'.repeat(30) })).status).toBe(401)
    })

    it('stops one Apple ID from unlocking several Loikmon accounts', async () => {
      const owner = await registerUser(t.app, 'owner@example.com')
      const other = await registerUser(t.app, 'sharer@example.com')
      const noToken = signJws(transactionPayload({ originalTransactionId: 'shared-orig', transactionId: 'shared-tx' }))
      expect((await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(owner.token)).send({ platform: 'ios', transaction_jws: noToken })).status).toBe(200)

      const stolen = await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(other.token)).send({ platform: 'ios', transaction_jws: noToken })
      expect([stolen.status, stolen.body.code]).toEqual([409, 'PURCHASE_ALREADY_LINKED'])

      const boughtForOwner = signJws(transactionPayload({ originalTransactionId: 'owner-orig-2', appAccountToken: owner.user.id }))
      const misuse = await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(other.token)).send({ platform: 'ios', transaction_jws: boughtForOwner })
      expect(misuse.body.code).toBe('PURCHASE_ALREADY_LINKED')
      expect(await canRead(other.token)).toBe(403)
    })

    it('keeps access in sync from App Store Server Notifications, idempotently', async () => {
      const { token, user } = await registerUser(t.app, 'renewals@example.com')
      const base = { originalTransactionId: 'notify-orig', appAccountToken: user.id }

      // SUBSCRIBED arrives before the app calls /verify: linked through appAccountToken.
      const subscribed = notificationPayload({ type: 'SUBSCRIBED', subtype: 'INITIAL_BUY', status: 1, transaction: transactionPayload({ ...base, transactionId: 'n-1' }), renewal: renewalPayload(base) })
      expect((await request(t.app).post('/api/v1/webhooks/apple').send({ signedPayload: subscribed })).body.outcome).toBe('processed')
      expect(await canRead(token)).toBe(200)

      // Apple retries deliveries: the same notificationUUID is processed once.
      const renewUuid = crypto.randomUUID()
      const renew = notificationPayload({ type: 'DID_RENEW', uuid: renewUuid, status: 1, transaction: transactionPayload({ ...base, transactionId: 'n-2', expiresDate: Date.now() + 60 * DAY }), renewal: renewalPayload(base) })
      expect((await request(t.app).post('/api/v1/webhooks/apple').send({ signedPayload: renew })).body.outcome).toBe('processed')
      expect((await request(t.app).post('/api/v1/webhooks/apple').send({ signedPayload: renew })).body.outcome).toBe('duplicate')
      const afterRenew = await request(t.app).get('/api/v1/subscriptions/me').set(bearer(token))
      expect(new Date(afterRenew.body.entitlement.expires_at).getTime()).toBeGreaterThan(Date.now() + 59 * DAY)

      // User turns off auto-renew: still entitled until the period ends.
      const off = notificationPayload({ type: 'DID_CHANGE_RENEWAL_STATUS', subtype: 'AUTO_RENEW_DISABLED', status: 1, transaction: transactionPayload({ ...base, transactionId: 'n-2', expiresDate: Date.now() + 60 * DAY }), renewal: renewalPayload({ ...base, autoRenewStatus: 0 }) })
      await request(t.app).post('/api/v1/webhooks/apple').send({ signedPayload: off })
      const canceled = await request(t.app).get('/api/v1/subscriptions/me').set(bearer(token))
      expect(canceled.body.entitlement).toMatchObject({ active: true, subscription: { status: 'canceled', auto_renew: false } })

      // Refund: access is revoked immediately.
      const refund = notificationPayload({ type: 'REFUND', status: 5, transaction: transactionPayload({ ...base, transactionId: 'n-2', revocationDate: Date.now(), revocationReason: 0 }) })
      expect((await request(t.app).post('/api/v1/webhooks/apple').send({ signedPayload: refund })).body.outcome).toBe('processed')
      expect(await canRead(token)).toBe(403)
    })

    it('accepts but ignores notifications for unknown subscriptions and rejects forged ones', async () => {
      const orphan = notificationPayload({ type: 'DID_RENEW', transaction: transactionPayload({ originalTransactionId: 'nobody' }) })
      expect((await request(t.app).post('/api/v1/webhooks/apple').send({ signedPayload: orphan })).body.outcome).toBe('ignored')
      const test = notificationPayload({ type: 'TEST' })
      expect((await request(t.app).post('/api/v1/webhooks/apple').send({ signedPayload: test })).status).toBe(200)

      const parts = orphan.split('.')
      const forged = await request(t.app).post('/api/v1/webhooks/apple').send({ signedPayload: `${parts[0]}.${parts[1]}.AAAA` })
      expect([forged.status, forged.body.code]).toEqual([401, 'WEBHOOK_UNAUTHORIZED'])
    })
  })

  describe('Android (Google Play Billing)', () => {
    it('verifies a purchase token, acknowledges it and unlocks the catalogue', async () => {
      const { token, user } = await registerUser(t.app, 'android@example.com')
      t.playApi.purchases.set('play-token-1', playPurchase({ basePlanId: 'quarterly', accountId: user.id }))

      const res = await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(token)).send({ platform: 'android', product_id: 'loikmon_premium', purchase_token: 'play-token-1' })
      expect(res.status).toBe(200)
      expect(res.body.entitlement.subscription).toMatchObject({ plan_code: 'quarterly', platform: 'google_play', status: 'active' })
      expect(t.playApi.acknowledged).toContain('play-token-1')
      expect(await canRead(token)).toBe(200)

      const unknown = await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(token)).send({ platform: 'android', product_id: 'loikmon_premium', purchase_token: 'never-issued' })
      expect(unknown.body.code).toBe('PURCHASE_INVALID')
    })

    it('reports store outages as retryable 502s', async () => {
      const { token } = await registerUser(t.app, 'outage@example.com')
      t.playApi.purchases.set('play-token-outage', playPurchase())
      t.playApi.failNext = 'unavailable'
      const res = await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(token)).send({ platform: 'android', product_id: 'loikmon_premium', purchase_token: 'play-token-outage' })
      expect([res.status, res.body.code]).toEqual([502, 'STORE_UNAVAILABLE'])
    })

    it('processes authenticated RTDN pushes: cancel, upgrade, refund', async () => {
      const { token, user } = await registerUser(t.app, 'rtdn@example.com')
      t.playApi.purchases.set('play-token-2', playPurchase({ basePlanId: 'monthly', accountId: user.id }))
      await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(token)).send({ platform: 'android', product_id: 'loikmon_premium', purchase_token: 'play-token-2' })

      // Unauthenticated pushes are refused.
      const anonymous = await request(t.app).post('/api/v1/webhooks/google').send(pushBody({ testNotification: {} }))
      expect(anonymous.status).toBe(401)

      // Cancellation scheduled: access continues until expiry.
      t.playApi.purchases.get('play-token-2')!.subscriptionState = 'SUBSCRIPTION_STATE_CANCELED'
      const cancelMsg = pushBody({ subscriptionNotification: { notificationType: 3, purchaseToken: 'play-token-2', subscriptionId: 'loikmon_premium' } }, 'msg-cancel')
      expect((await googlePush(cancelMsg)).body.outcome).toBe('processed')
      expect((await googlePush(cancelMsg)).body.outcome).toBe('duplicate')
      expect((await request(t.app).get('/api/v1/subscriptions/me').set(bearer(token))).body.entitlement).toMatchObject({ active: true, subscription: { status: 'canceled' } })

      // Upgrade to yearly: Play issues a new token linked to the old one.
      t.playApi.purchases.set('play-token-3', playPurchase({ basePlanId: 'yearly', linkedPurchaseToken: 'play-token-2', expiry: new Date(Date.now() + 365 * DAY) }))
      const upgrade = pushBody({ subscriptionNotification: { notificationType: 4, purchaseToken: 'play-token-3', subscriptionId: 'loikmon_premium' } })
      expect((await googlePush(upgrade)).body.outcome).toBe('processed')
      const me = await request(t.app).get('/api/v1/subscriptions/me').set(bearer(token))
      const statuses = Object.fromEntries(me.body.subscriptions.map((s: { plan_code: string; status: string }) => [s.plan_code, s.status]))
      expect(statuses).toEqual({ yearly: 'active', monthly: 'expired' })
      expect(me.body.entitlement.subscription.plan_code).toBe('yearly')

      // Refund / chargeback revokes access.
      expect((await googlePush(pushBody({ voidedPurchaseNotification: { purchaseToken: 'play-token-3', orderId: 'GPA.9', refundType: 1 } }))).body.outcome).toBe('processed')
      expect(await canRead(token)).toBe(403)
    })

    it('reconciles missed notifications against the store', async () => {
      const { token, user } = await registerUser(t.app, 'reconcile@example.com')
      t.playApi.purchases.set('play-token-4', playPurchase({ accountId: user.id, expiry: new Date(Date.now() + 12 * 3600_000) }))
      await request(t.app).post('/api/v1/subscriptions/verify').set(bearer(token)).send({ platform: 'android', product_id: 'loikmon_premium', purchase_token: 'play-token-4' })

      // The subscription expired at Google but no RTDN reached us.
      Object.assign(t.playApi.purchases.get('play-token-4')!, { subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' })
      const result = await t.container.ctx.services.subscriptions.reconcile()
      expect(result.updated).toBeGreaterThanOrEqual(1)
      expect(result.failed).toBe(0)
      expect(await canRead(token)).toBe(403)
    })
  })

  it('restores several purchases and reports per-purchase results', async () => {
    const { token, user } = await registerUser(t.app, 'restore@example.com')
    const res = await request(t.app)
      .post('/api/v1/subscriptions/restore')
      .set(bearer(token))
      .send({
        purchases: [
          { platform: 'ios', transaction_jws: signJws(transactionPayload({ originalTransactionId: 'restore-orig', appAccountToken: user.id })) },
          { platform: 'ios', transaction_jws: signJws(transactionPayload({ originalTransactionId: 'restore-bad' }), { tamper: true }) },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.results.map((r: { ok: boolean; code?: string }) => r.code ?? 'ok')).toEqual(['ok', 'PURCHASE_INVALID'])
    expect(res.body.entitlement.active).toBe(true)
  })

  it('records every store event for auditing', async () => {
    const events = await t.container.ctx.db.selectFrom('subscription_events').select(['platform', 'event_type', 'outcome']).execute()
    expect(events.some((e) => e.event_type === 'REFUND' && e.outcome === 'processed')).toBe(true)
    expect(events.some((e) => e.platform === 'google_play' && e.event_type === 'VOIDED_PURCHASE')).toBe(true)
  })
})
