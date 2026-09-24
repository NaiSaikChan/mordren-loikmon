import type { Entitlement, SubscriptionRecord } from '@loikmon/api'
import { PRIVACY_URL, TERMS_URL, describeSubscription, formatDate } from '@/lib/subscriptionStatus'

type Sub = NonNullable<Entitlement['subscription']>

const sub = (overrides: Partial<Sub>): Sub => ({
  id: 's1',
  plan_code: 'yearly',
  platform: 'app_store',
  status: 'active',
  auto_renew: true,
  expires_at: '2027-01-01T00:00:00Z',
  in_grace_period: false,
  environment: 'Production',
  product_id: 'org.loikmon.mobile.premium.yearly',
  ...overrides,
})

const entitlement = (overrides: Partial<Entitlement>): Entitlement => ({
  active: true,
  source: 'subscription',
  expires_at: '2027-01-01T00:00:00Z',
  subscription: sub({}),
  ...overrides,
})

describe('describeSubscription', () => {
  it('active + auto-renew', () => {
    expect(describeSubscription(entitlement({}))).toMatchObject({ kind: 'active_renewing', store: 'app_store', planCode: 'yearly', storeManaged: true })
  })

  it('active but canceled keeps access until expiry', () => {
    expect(describeSubscription(entitlement({ subscription: sub({ status: 'canceled', auto_renew: false }) })).kind).toBe('active_canceled')
  })

  it('grace period / billing retry ask to update the payment method', () => {
    expect(describeSubscription(entitlement({ subscription: sub({ status: 'grace_period', in_grace_period: true, platform: 'google_play' }) }))).toMatchObject({
      kind: 'billing_issue',
      store: 'google_play',
    })
    expect(describeSubscription(entitlement({ active: false, subscription: sub({ status: 'billing_retry' }) })).kind).toBe('billing_issue')
  })

  it('grants and admin access are not store-managed', () => {
    expect(describeSubscription(entitlement({ source: 'grant', subscription: null }))).toMatchObject({ kind: 'granted', storeManaged: false })
  })

  it('uses the history when there is no current entitlement', () => {
    const history = [{ ...sub({ status: 'expired' }), started_at: null, updated_at: '2026-01-01' }] as SubscriptionRecord[]
    expect(describeSubscription({ active: false, source: null, expires_at: null, subscription: null }, history).kind).toBe('expired')
    expect(describeSubscription(null).kind).toBe('none')
  })
})

describe('formatDate', () => {
  it('tolerates missing and invalid dates', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('not a date')).toBe('')
    expect(formatDate('2027-01-01T00:00:00Z')).not.toBe('')
  })
})

describe('legal links', () => {
  it('point at the published terms and privacy policy', () => {
    expect(TERMS_URL).toBe('https://loikmon.org/terms')
    expect(PRIVACY_URL).toBe('https://loikmon.org/privacy')
  })
})
