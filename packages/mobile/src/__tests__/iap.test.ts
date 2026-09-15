/**
 * Store purchase logic (expo-iap ⇄ Loikmon backend).
 *
 * `@loikmon/api` subscription calls and expo-iap functions are mocked; the
 * handlers under test are the pure functions the SubscriptionProvider wires
 * to the single `useIAP` instance.
 */
import { ApiError, subscriptions } from '@loikmon/api'
import type { Entitlement, Plan, PurchaseProof } from '@loikmon/api'
import { finishTransaction } from 'expo-iap'
import type { ProductSubscription, Purchase, SubscriptionOffer } from 'expo-iap'
import {
  bestValuePlanCode,
  buildPurchaseProof,
  buildSubscriptionRequest,
  isRetryableVerifyError,
  isUserCancelled,
  mergePlansWithProducts,
  pickAndroidOffer,
  processPurchase,
  purchaseKey,
  resolveManageUrl,
  restoreWithBackend,
  selectRetryCandidates,
  storePlatformOf,
} from '@/lib/iap'

jest.mock('@loikmon/api', () => ({
  ...jest.requireActual('@loikmon/api'),
  subscriptions: { verify: jest.fn(), restore: jest.fn() },
}))

const mockVerify = subscriptions.verify as unknown as jest.Mock
const mockRestore = subscriptions.restore as unknown as jest.Mock
const mockFinish = finishTransaction as unknown as jest.Mock

const ACTIVE: Entitlement = { active: true, source: 'subscription', expires_at: '2026-10-15T00:00:00Z', subscription: null }

function iosPurchase(overrides: Record<string, unknown> = {}): Purchase {
  return {
    id: '2000000123',
    transactionId: '2000000123',
    productId: 'org.loikmon.mobile.premium.monthly',
    purchaseToken: 'eyJhbGciOiJFUzI1NiJ9.payload.signature',
    purchaseState: 'purchased',
    isAutoRenewing: true,
    quantity: 1,
    store: 'apple',
    transactionDate: 1_700_000_000_000,
    ...overrides,
  } as unknown as Purchase
}

function androidPurchase(overrides: Record<string, unknown> = {}): Purchase {
  return {
    id: 'GPA.1234-5678',
    productId: 'loikmon_premium',
    purchaseToken: 'play-token-abcdefghijk',
    purchaseState: 'purchased',
    isAutoRenewing: true,
    isAcknowledgedAndroid: false,
    quantity: 1,
    store: 'google',
    transactionDate: 1_700_000_000_000,
    ...overrides,
  } as unknown as Purchase
}

function plan(code: string, months: number, cents: number, savings: number): Plan {
  return {
    code,
    name: code,
    description: null,
    price_cents: cents,
    price: (cents / 100).toFixed(2),
    currency: 'USD',
    period_months: months,
    monthly_price_cents: Math.round(cents / months),
    savings_percent: savings,
    apple_product_id: `org.loikmon.mobile.premium.${code}`,
    google_product_id: 'loikmon_premium',
    google_base_plan_id: code,
  }
}

// $4 / month, $10 / 3 months, $20 / 6 months, $45 / year
const PLANS: Plan[] = [plan('monthly', 1, 400, 0), plan('quarterly', 3, 1000, 17), plan('semiannual', 6, 2000, 17), plan('yearly', 12, 4500, 6)]

function offer(overrides: Partial<SubscriptionOffer>): SubscriptionOffer {
  return { id: '', displayPrice: '', price: 0, type: 'introductory', ...overrides } as SubscriptionOffer
}

const androidProduct = {
  id: 'loikmon_premium',
  platform: 'android',
  type: 'subs',
  title: 'Loikmon Premium',
  description: '',
  displayPrice: '฿150.00',
  currency: 'THB',
  nameAndroid: 'Loikmon Premium',
  subscriptionOffers: [
    offer({
      id: 'monthly',
      basePlanIdAndroid: 'monthly',
      offerTokenAndroid: 'tok-monthly',
      pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: '฿150.00', billingCycleCount: 0, billingPeriod: 'P1M', priceAmountMicros: '150000000', priceCurrencyCode: 'THB', recurrenceMode: 1 }] },
    }),
    offer({
      id: 'intro-50',
      basePlanIdAndroid: 'yearly',
      offerTokenAndroid: 'tok-yearly-intro',
      pricingPhasesAndroid: {
        pricingPhaseList: [
          { formattedPrice: '฿750.00', billingCycleCount: 1, billingPeriod: 'P1Y', priceAmountMicros: '750000000', priceCurrencyCode: 'THB', recurrenceMode: 2 },
          { formattedPrice: '฿1,500.00', billingCycleCount: 0, billingPeriod: 'P1Y', priceAmountMicros: '1500000000', priceCurrencyCode: 'THB', recurrenceMode: 1 },
        ],
      },
    }),
    offer({
      id: 'yearly',
      basePlanIdAndroid: 'yearly',
      offerTokenAndroid: 'tok-yearly',
      pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: '฿1,500.00', billingCycleCount: 0, billingPeriod: 'P1Y', priceAmountMicros: '1500000000', priceCurrencyCode: 'THB', recurrenceMode: 1 }] },
    }),
  ],
} as unknown as ProductSubscription

beforeEach(() => {
  jest.clearAllMocks()
})

describe('storePlatformOf', () => {
  it('only maps native store platforms', () => {
    expect(storePlatformOf('ios')).toBe('ios')
    expect(storePlatformOf('android')).toBe('android')
    expect(storePlatformOf('web')).toBeNull()
  })
})

describe('buildPurchaseProof', () => {
  it('iOS: sends the StoreKit 2 JWS from purchaseToken', () => {
    expect(buildPurchaseProof(iosPurchase(), 'ios')).toEqual({
      platform: 'ios',
      transaction_jws: 'eyJhbGciOiJFUzI1NiJ9.payload.signature',
    })
  })

  it('Android: sends product id + purchase token', () => {
    expect(buildPurchaseProof(androidPurchase(), 'android')).toEqual({
      platform: 'android',
      product_id: 'loikmon_premium',
      purchase_token: 'play-token-abcdefghijk',
    })
  })

  it('returns null without a token', () => {
    expect(buildPurchaseProof(iosPurchase({ purchaseToken: null }), 'ios')).toBeNull()
    expect(buildPurchaseProof(androidPurchase({ purchaseToken: '  ' }), 'android')).toBeNull()
  })
})

describe('purchaseKey', () => {
  it('uses the transaction id on iOS and the purchase token on Android', () => {
    expect(purchaseKey(iosPurchase(), 'ios')).toBe('2000000123')
    expect(purchaseKey(androidPurchase(), 'android')).toBe('play-token-abcdefghijk')
  })
})

describe('pickAndroidOffer', () => {
  it('picks the offer of the requested base plan', () => {
    expect(pickAndroidOffer(androidProduct, 'monthly')?.offerTokenAndroid).toBe('tok-monthly')
  })

  it('prefers the plain base-plan offer over promotional offers', () => {
    expect(pickAndroidOffer(androidProduct, 'yearly')?.offerTokenAndroid).toBe('tok-yearly')
  })

  it('falls back to a single-phase offer when ids are not base-plan ids', () => {
    const product = {
      subscriptionOffers: [
        offer({ id: 'promo', basePlanIdAndroid: 'quarterly', offerTokenAndroid: 'a', pricingPhasesAndroid: { pricingPhaseList: [{}, {}] as never } }),
        offer({ id: 'other', basePlanIdAndroid: 'quarterly', offerTokenAndroid: 'b', pricingPhasesAndroid: { pricingPhaseList: [{}] as never } }),
      ],
    }
    expect(pickAndroidOffer(product, 'quarterly')?.offerTokenAndroid).toBe('b')
  })

  it('returns null for unknown base plans or missing products', () => {
    expect(pickAndroidOffer(androidProduct, 'semiannual')).toBeNull()
    expect(pickAndroidOffer(undefined, 'monthly')).toBeNull()
  })
})

describe('mergePlansWithProducts', () => {
  it('iOS: uses the localised store price and marks missing products unavailable', () => {
    const products = [
      { id: 'org.loikmon.mobile.premium.monthly', platform: 'ios', displayPrice: '฿149.00' },
    ] as unknown as ProductSubscription[]
    const merged = mergePlansWithProducts(PLANS, products, 'ios')
    expect(merged[0]).toMatchObject({ productId: 'org.loikmon.mobile.premium.monthly', displayPrice: '฿149.00', priceFromStore: true, available: true })
    expect(merged[1]).toMatchObject({ displayPrice: '$10.00', priceFromStore: false, available: false })
  })

  it('Android: resolves base plan offers of the single subscription product', () => {
    const merged = mergePlansWithProducts(PLANS, [androidProduct], 'android')
    const yearly = merged.find((o) => o.plan.code === 'yearly')
    expect(yearly).toMatchObject({ productId: 'loikmon_premium', basePlanId: 'yearly', offerToken: 'tok-yearly', displayPrice: '฿1,500.00', available: true })
    expect(merged.find((o) => o.plan.code === 'semiannual')).toMatchObject({ available: false, displayPrice: '$20.00' })
  })

  it('without a store (web) falls back to formatted backend prices', () => {
    expect(mergePlansWithProducts(PLANS, [], null).map((o) => o.displayPrice)).toEqual(['$4.00', '$10.00', '$20.00', '$45.00'])
  })

  it('highlights exactly one best-value plan', () => {
    expect(bestValuePlanCode(PLANS)).toBe('semiannual')
    expect(mergePlansWithProducts(PLANS, [], null).filter((o) => o.bestValue)).toHaveLength(1)
    expect(bestValuePlanCode([plan('monthly', 1, 400, 0)])).toBeNull()
  })
})

describe('buildSubscriptionRequest', () => {
  const token = '0b6f8f2e-6a55-4a3b-9d2c-1f6a0b9c3d11'

  it('iOS: passes the account token as appAccountToken', () => {
    const [monthly] = mergePlansWithProducts(PLANS, [{ id: 'org.loikmon.mobile.premium.monthly', displayPrice: '$4' }] as never, 'ios')
    expect(buildSubscriptionRequest(monthly, 'ios', token)).toEqual({
      type: 'subs',
      request: { apple: { sku: 'org.loikmon.mobile.premium.monthly', appAccountToken: token } },
    })
  })

  it('Android: passes the base plan offer token and obfuscatedAccountId', () => {
    const yearly = mergePlansWithProducts(PLANS, [androidProduct], 'android').find((o) => o.plan.code === 'yearly')!
    expect(buildSubscriptionRequest(yearly, 'android', token)).toEqual({
      type: 'subs',
      request: {
        google: {
          skus: ['loikmon_premium'],
          subscriptionOffers: [{ sku: 'loikmon_premium', offerToken: 'tok-yearly' }],
          obfuscatedAccountId: token,
        },
      },
    })
  })

  it('returns null without an offer token or account token', () => {
    const semiannual = mergePlansWithProducts(PLANS, [androidProduct], 'android').find((o) => o.plan.code === 'semiannual')!
    expect(buildSubscriptionRequest(semiannual, 'android', token)).toBeNull()
    const [monthly] = mergePlansWithProducts(PLANS, [], 'ios')
    expect(buildSubscriptionRequest(monthly, 'ios', '')).toBeNull()
  })
})

describe('isRetryableVerifyError', () => {
  it('treats transport, store outage and server errors as transient', () => {
    expect(isRetryableVerifyError(new ApiError('offline', 0, 'NETWORK_ERROR'))).toBe(true)
    expect(isRetryableVerifyError(new ApiError('store down', 502, 'STORE_UNAVAILABLE'))).toBe(true)
    expect(isRetryableVerifyError(new ApiError('boom', 500, 'INTERNAL_ERROR'))).toBe(true)
    expect(isRetryableVerifyError(new ApiError('slow down', 429, 'RATE_LIMITED'))).toBe(true)
    expect(isRetryableVerifyError(new ApiError('no session', 401, 'UNAUTHORIZED'))).toBe(true)
  })

  it('treats definitive rejections as final', () => {
    expect(isRetryableVerifyError(new ApiError('invalid', 422, 'PURCHASE_INVALID'))).toBe(false)
    expect(isRetryableVerifyError(new ApiError('linked', 409, 'PURCHASE_ALREADY_LINKED'))).toBe(false)
    expect(isRetryableVerifyError(new ApiError('bad', 400, 'VALIDATION_ERROR'))).toBe(false)
  })
})

describe('isUserCancelled', () => {
  it('detects the expo-iap cancel code', () => {
    expect(isUserCancelled({ code: 'user-cancelled' })).toBe(true)
    expect(isUserCancelled({ code: 'network-error' })).toBe(false)
    expect(isUserCancelled(null)).toBe(false)
  })
})

describe('processPurchase — verify, then finish', () => {
  const deps = (platform: 'ios' | 'android') => ({
    platform,
    verify: async (proof: PurchaseProof) => (await subscriptions.verify(proof)).data,
    finishTransaction: finishTransaction as unknown as (args: { purchase: Purchase; isConsumable: boolean }) => Promise<void>,
  })

  it('finishes the transaction only after the backend verified it', async () => {
    const calls: string[] = []
    mockVerify.mockImplementation(async () => {
      calls.push('verify')
      return { data: { status: 'ok', entitlement: ACTIVE } }
    })
    mockFinish.mockImplementation(async () => {
      calls.push('finish')
    })

    const purchase = iosPurchase()
    const outcome = await processPurchase(purchase, deps('ios'))

    expect(outcome).toEqual({ status: 'verified', entitlement: ACTIVE, finished: true })
    expect(calls).toEqual(['verify', 'finish'])
    expect(mockVerify).toHaveBeenCalledWith({ platform: 'ios', transaction_jws: purchase.purchaseToken })
    expect(mockFinish).toHaveBeenCalledWith({ purchase, isConsumable: false })
  })

  it('verifies Android purchases with product id + token', async () => {
    mockVerify.mockResolvedValue({ data: { entitlement: ACTIVE } })
    await processPurchase(androidPurchase(), deps('android'))
    expect(mockVerify).toHaveBeenCalledWith({ platform: 'android', product_id: 'loikmon_premium', purchase_token: 'play-token-abcdefghijk' })
    expect(mockFinish).toHaveBeenCalledTimes(1)
  })

  it('keeps the transaction unfinished when the server/store is unreachable', async () => {
    mockVerify.mockRejectedValueOnce(new ApiError('offline', 0, 'NETWORK_ERROR'))
    const outcome = await processPurchase(iosPurchase(), deps('ios'))
    expect(outcome).toMatchObject({ status: 'retry', code: 'NETWORK_ERROR' })
    expect(mockFinish).not.toHaveBeenCalled()

    mockVerify.mockRejectedValueOnce(new ApiError('Google Play could not be reached', 502, 'STORE_UNAVAILABLE'))
    expect(await processPurchase(androidPurchase(), deps('android'))).toMatchObject({ status: 'retry', code: 'STORE_UNAVAILABLE' })
    expect(mockFinish).not.toHaveBeenCalled()
  })

  it('does not finish a purchase linked to another account', async () => {
    mockVerify.mockRejectedValueOnce(new ApiError('linked', 409, 'PURCHASE_ALREADY_LINKED'))
    const outcome = await processPurchase(iosPurchase(), deps('ios'))
    expect(outcome).toMatchObject({ status: 'rejected', code: 'PURCHASE_ALREADY_LINKED' })
    expect(mockFinish).not.toHaveBeenCalled()
  })

  it('leaves pending (not yet paid) purchases alone', async () => {
    const outcome = await processPurchase(androidPurchase({ purchaseState: 'pending' }), deps('android'))
    expect(outcome).toEqual({ status: 'pending' })
    expect(mockVerify).not.toHaveBeenCalled()
    expect(mockFinish).not.toHaveBeenCalled()
  })

  it('still reports the entitlement when finishing fails (transaction is re-delivered later)', async () => {
    mockVerify.mockResolvedValue({ data: { entitlement: ACTIVE } })
    mockFinish.mockRejectedValueOnce(new Error('billing service disconnected'))
    const onFinishError = jest.fn()
    const outcome = await processPurchase(iosPurchase(), { ...deps('ios'), onFinishError })
    expect(outcome).toEqual({ status: 'verified', entitlement: ACTIVE, finished: false })
    expect(onFinishError).toHaveBeenCalled()
  })
})

describe('selectRetryCandidates', () => {
  const skus = new Set(['loikmon_premium', 'org.loikmon.mobile.premium.monthly'])

  it('Android: retries unacknowledged or remembered purchases of our products', () => {
    const unacked = androidPurchase()
    const acked = androidPurchase({ purchaseToken: 'acked', isAcknowledgedAndroid: true })
    const remembered = androidPurchase({ purchaseToken: 'remembered', isAcknowledgedAndroid: true })
    const foreign = androidPurchase({ productId: 'another_product', purchaseToken: 'x' })
    const pending = androidPurchase({ purchaseToken: 'p', purchaseState: 'pending' })
    const result = selectRetryCandidates([unacked, acked, remembered, foreign, pending], new Set(['remembered']), 'android', skus)
    expect(result).toEqual([unacked, remembered])
  })

  it('iOS: only retries purchases remembered after a transient failure', () => {
    const a = iosPurchase()
    const b = iosPurchase({ id: '2000000999', transactionId: '2000000999' })
    expect(selectRetryCandidates([a, b], new Set(['2000000999']), 'ios', skus)).toEqual([b])
  })
})

describe('restoreWithBackend', () => {
  const skus = new Set(['loikmon_premium'])

  it('sends de-duplicated proofs and finishes only the accepted purchases', async () => {
    const ok = androidPurchase()
    const duplicate = androidPurchase()
    const linked = androidPurchase({ purchaseToken: 'linked-token' })
    mockRestore.mockResolvedValue({
      data: { status: 'ok', entitlement: ACTIVE, results: [{ ok: true, subscription_id: 's1' }, { ok: false, code: 'PURCHASE_ALREADY_LINKED', message: 'linked' }] },
    })

    const outcome = await restoreWithBackend([ok, duplicate, linked, androidPurchase({ productId: 'other' })], {
      platform: 'android',
      skus,
      restore: async (proofs) => (await subscriptions.restore(proofs)).data,
      finishTransaction: finishTransaction as never,
    })

    expect(mockRestore).toHaveBeenCalledWith([
      { platform: 'android', product_id: 'loikmon_premium', purchase_token: 'play-token-abcdefghijk' },
      { platform: 'android', product_id: 'loikmon_premium', purchase_token: 'linked-token' },
    ])
    expect(mockFinish).toHaveBeenCalledTimes(1)
    expect(mockFinish).toHaveBeenCalledWith({ purchase: ok, isConsumable: false })
    expect(outcome).toMatchObject({ entitlement: ACTIVE, restored: 1, alreadyLinked: true, nothingToRestore: false })
  })

  it('does not call the backend when the store has nothing to restore', async () => {
    const outcome = await restoreWithBackend([], { platform: 'ios', skus, restore: mockRestore, finishTransaction: finishTransaction as never })
    expect(outcome.nothingToRestore).toBe(true)
    expect(mockRestore).not.toHaveBeenCalled()
  })
})

describe('resolveManageUrl', () => {
  const manage_urls = { app_store: 'https://apps.apple.com/account/subscriptions', google_play: 'https://play.google.com/store/account/subscriptions?package=org.loikmon.mobile' }

  it('uses the store the subscription was bought in', () => {
    const status = {
      entitlement: { ...ACTIVE, subscription: { platform: 'app_store' } } as unknown as Entitlement,
      subscriptions: [],
      manage_urls,
    }
    expect(resolveManageUrl(status, 'android')).toBe(manage_urls.app_store)
  })

  it("falls back to this device's store", () => {
    expect(resolveManageUrl({ entitlement: { ...ACTIVE }, subscriptions: [], manage_urls }, 'android')).toBe(manage_urls.google_play)
    expect(resolveManageUrl(null, 'ios')).toBe('https://apps.apple.com/account/subscriptions')
    expect(resolveManageUrl(null, null)).toBeNull()
  })
})
