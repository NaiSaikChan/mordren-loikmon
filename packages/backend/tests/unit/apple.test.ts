import { describe, expect, it } from 'vitest'
import { AppError } from '../../src/lib/errors.js'
import { snapshotFromApple } from '../../src/payments/apple.js'
import {
  createTestAppleService,
  notificationPayload,
  renewalPayload,
  signJws,
  transactionPayload,
} from '../helpers/apple.js'

async function expectAppError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(AppError)
  expect((err as AppError).code).toBe(code)
}

describe('AppleStoreService.verifyTransaction (real JWS verification)', () => {
  const apple = createTestAppleService()

  it('accepts a correctly signed auto-renewable subscription', async () => {
    const snapshot = await apple.verifyTransaction(signJws(transactionPayload({ appAccountToken: '11111111-1111-4111-8111-111111111111' })))
    expect(snapshot).toMatchObject({
      platform: 'app_store',
      storeSubscriptionId: '2000000000000001',
      productId: 'org.loikmon.mobile.premium.monthly',
      status: 'active',
      environment: 'sandbox',
      accountToken: '11111111-1111-4111-8111-111111111111',
    })
    expect(snapshot.expiresAt!.getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects a payload modified after signing', async () => {
    await expectAppError(apple.verifyTransaction(signJws(transactionPayload(), { tamper: true })), 'PURCHASE_INVALID')
  })

  it('rejects an unsigned (decoded-only) token', async () => {
    const fake = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(transactionPayload())).toString('base64url')}.`
    await expectAppError(apple.verifyTransaction(fake), 'PURCHASE_INVALID')
  })

  it('rejects transactions from another app', async () => {
    await expectAppError(apple.verifyTransaction(signJws(transactionPayload({ bundleId: 'com.someone.else' }))), 'PURCHASE_INVALID')
  })

  it('rejects consumables / non-subscription purchases', async () => {
    await expectAppError(apple.verifyTransaction(signJws(transactionPayload({ type: 'Consumable' }))), 'PURCHASE_INVALID')
  })

  it('rejects sandbox purchases when the server disallows them', async () => {
    const strict = createTestAppleService({ allowSandbox: false })
    await expectAppError(strict.verifyTransaction(signJws(transactionPayload())), 'PURCHASE_INVALID')
  })

  it('rejects garbage input', async () => {
    await expectAppError(apple.verifyTransaction('not-a-jws'), 'PURCHASE_INVALID')
  })

  it('uses the App Store Server API status when configured', async () => {
    const withApi = createTestAppleService({
      statusApi: {
        async getAllSubscriptionStatuses() {
          return {
            data: [
              {
                lastTransactions: [
                  {
                    originalTransactionId: '2000000000000001',
                    status: 4,
                    signedTransactionInfo: signJws(transactionPayload({ expiresDate: Date.now() - 3600_000 })),
                    signedRenewalInfo: signJws(renewalPayload({ isInBillingRetryPeriod: true, gracePeriodExpiresDate: Date.now() + 5 * 86400_000 })),
                  },
                ],
              },
            ],
          }
        },
      },
    })
    const snapshot = await withApi.verifyTransaction(signJws(transactionPayload()))
    expect(snapshot.status).toBe('grace_period')
    expect(snapshot.graceExpiresAt!.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('AppleStoreService.decodeNotification', () => {
  const apple = createTestAppleService()

  it('verifies the notification and the nested transaction and renewal info', async () => {
    const notification = await apple.decodeNotification(
      notificationPayload({
        type: 'DID_CHANGE_RENEWAL_STATUS',
        subtype: 'AUTO_RENEW_DISABLED',
        uuid: 'c7b3b0f4-0000-4000-8000-000000000001',
        status: 1,
        transaction: transactionPayload(),
        renewal: renewalPayload({ autoRenewStatus: 0 }),
      }),
    )
    expect(notification).toMatchObject({ eventId: 'c7b3b0f4-0000-4000-8000-000000000001', type: 'DID_CHANGE_RENEWAL_STATUS', subtype: 'AUTO_RENEW_DISABLED' })
    expect(notification.snapshot).toMatchObject({ status: 'canceled', autoRenew: false })
  })

  it('returns no snapshot for TEST notifications', async () => {
    const notification = await apple.decodeNotification(notificationPayload({ type: 'TEST' }))
    expect(notification.type).toBe('TEST')
    expect(notification.snapshot).toBeNull()
  })

  it('refuses forged notifications', async () => {
    const forged = notificationPayload({ type: 'DID_RENEW', transaction: transactionPayload() }).split('.')
    forged[2] = Buffer.from('forged-signature').toString('base64url')
    await expectAppError(apple.decodeNotification(forged.join('.')), 'WEBHOOK_UNAUTHORIZED')
  })
})

describe('snapshotFromApple status mapping', () => {
  const now = new Date()
  const tx = (o: Record<string, unknown> = {}) => transactionPayload(o) as never
  const renewal = (o: Record<string, unknown> = {}) => renewalPayload(o) as never

  it.each([
    ['active + auto-renew', tx(), renewal(), undefined, 'active'],
    ['active, auto-renew off', tx(), renewal({ autoRenewStatus: 0 }), undefined, 'canceled'],
    ['expired', tx({ expiresDate: Date.now() - 1000 }), renewal({ autoRenewStatus: 0 }), undefined, 'expired'],
    ['grace period', tx({ expiresDate: Date.now() - 1000 }), renewal({ gracePeriodExpiresDate: Date.now() + 86400_000 }), undefined, 'grace_period'],
    ['billing retry', tx({ expiresDate: Date.now() - 1000 }), renewal({ isInBillingRetryPeriod: true }), undefined, 'billing_retry'],
    ['refunded', tx({ revocationDate: Date.now() - 1000 }), renewal(), undefined, 'revoked'],
    ['status api: revoked', tx(), renewal(), 5, 'revoked'],
    ['status api: billing retry', tx(), renewal(), 3, 'billing_retry'],
    ['status api: expired', tx(), renewal(), 2, 'expired'],
  ])('%s', (_label, transaction, renewalInfo, status, expected) => {
    expect(snapshotFromApple(transaction, renewalInfo, status, now).status).toBe(expected)
  })
})
