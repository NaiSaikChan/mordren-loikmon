import { describe, expect, it } from 'vitest'
import type { EntitlementGrant, Subscription } from '../../src/db/types.js'
import { resolveAccess } from '../../src/domain/access.js'
import { accessUntil, computeEntitlement, grantIsActive } from '../../src/domain/entitlement.js'
import { decideOwnership } from '../../src/services/subscriptions.js'

const now = new Date('2026-09-15T12:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 86400_000)

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    plan_code: 'monthly',
    platform: 'app_store',
    store_subscription_id: 'orig-1',
    product_id: 'org.loikmon.mobile.premium.monthly',
    status: 'active',
    auto_renew: true,
    environment: 'production',
    started_at: days(-10),
    expires_at: days(20),
    grace_expires_at: null,
    canceled_at: null,
    revoked_at: null,
    latest_transaction_id: 't1',
    linked_purchase_token: null,
    last_verified_at: now,
    raw_data: null,
    created_at: days(-10),
    updated_at: now,
    ...overrides,
  }
}

function grant(overrides: Partial<EntitlementGrant> = {}): EntitlementGrant {
  return { id: 1, user_id: 'u1', reason: 'author', starts_at: days(-1), expires_at: null, granted_by: 'admin', revoked_at: null, created_at: days(-1), ...overrides }
}

describe('accessUntil', () => {
  it.each([
    ['active', days(5), null, days(5)],
    ['canceled', days(5), null, days(5)], // auto-renew off keeps access until the paid period ends
    ['grace_period', days(-1), days(3), days(3)],
    ['grace_period', days(2), null, days(2)],
    ['active', days(-1), null, null],
    ['billing_retry', days(5), null, null],
    ['paused', days(5), null, null],
    ['pending', days(5), null, null],
    ['expired', days(5), null, null],
    ['revoked', days(5), null, null],
  ] as const)('%s expiring %s (grace %s) → %s', (status, expires, grace, expected) => {
    expect(accessUntil({ status, expires_at: expires, grace_expires_at: grace }, now)).toEqual(expected)
  })
})

describe('computeEntitlement', () => {
  it('is inactive without subscriptions or grants', () => {
    expect(computeEntitlement({ subscriptions: [], grants: [], now })).toMatchObject({ active: false, source: null, subscription: null })
  })

  it('picks the subscription with the longest access across stores', () => {
    const apple = sub({ platform: 'app_store', expires_at: days(3) })
    const google = sub({ platform: 'google_play', expires_at: days(40), plan_code: 'yearly' })
    const result = computeEntitlement({ subscriptions: [apple, google], grants: [], now })
    expect(result.active).toBe(true)
    expect(result.source).toBe('subscription')
    expect(result.expires_at).toBe(days(40).toISOString())
    expect(result.subscription).toMatchObject({ platform: 'google_play', plan_code: 'yearly' })
  })

  it('reports the lapsed subscription so clients can explain why access ended', () => {
    const result = computeEntitlement({ subscriptions: [sub({ status: 'billing_retry', expires_at: days(-2) })], grants: [], now })
    expect(result.active).toBe(false)
    expect(result.subscription?.status).toBe('billing_retry')
  })

  it('falls back to an admin grant, preferring an unlimited one', () => {
    const result = computeEntitlement({
      subscriptions: [],
      grants: [grant({ expires_at: days(5) }), grant({ id: 2, expires_at: null })],
      now,
    })
    expect(result).toMatchObject({ active: true, source: 'grant', expires_at: null })
  })

  it('ignores revoked, future and expired grants', () => {
    const grants = [grant({ revoked_at: days(-1) }), grant({ starts_at: days(1) }), grant({ expires_at: days(-1) })]
    expect(grants.map((g) => grantIsActive(g, now))).toEqual([false, false, false])
    expect(computeEntitlement({ subscriptions: [], grants, now }).active).toBe(false)
  })

  it('gives admins access without a subscription', () => {
    expect(computeEntitlement({ role: 'admin', subscriptions: [], grants: [], now })).toMatchObject({ active: true, source: 'admin' })
  })
})

describe('resolveAccess', () => {
  const active = computeEntitlement({ subscriptions: [sub()], grants: [], now })
  const inactive = computeEntitlement({ subscriptions: [], grants: [], now })

  it('opens free items to everyone', () => {
    expect(resolveAccess({ isFree: true, isAuthenticated: false, entitlement: null })).toEqual({ granted: true, reason: 'free' })
  })
  it('asks anonymous visitors to sign in for paid items', () => {
    expect(resolveAccess({ isFree: false, isAuthenticated: false, entitlement: null })).toEqual({ granted: false, reason: 'login_required' })
  })
  it('requires a subscription for signed-in users without one', () => {
    expect(resolveAccess({ isFree: false, isAuthenticated: true, entitlement: inactive })).toEqual({ granted: false, reason: 'subscription_required' })
  })
  it('unlocks every paid item for subscribers', () => {
    expect(resolveAccess({ isFree: false, isAuthenticated: true, entitlement: active })).toEqual({ granted: true, reason: 'subscription' })
  })
})

describe('decideOwnership', () => {
  const me = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'

  it('allows claiming an unowned subscription', () => {
    expect(decideOwnership({ requestingUserId: me, existingOwnerId: null, accountToken: null })).toBe('allow')
  })
  it('allows the owner to re-verify', () => {
    expect(decideOwnership({ requestingUserId: me, existingOwnerId: me, accountToken: me })).toBe('allow')
  })
  it('rejects a subscription already linked to another account', () => {
    expect(decideOwnership({ requestingUserId: me, existingOwnerId: other, accountToken: null })).toBe('reject')
  })
  it('rejects a purchase made for another account (appAccountToken)', () => {
    expect(decideOwnership({ requestingUserId: me, existingOwnerId: null, accountToken: other })).toBe('reject')
  })
  it('ignores non-UUID account tokens set by other tooling', () => {
    expect(decideOwnership({ requestingUserId: me, existingOwnerId: null, accountToken: 'promo-campaign' })).toBe('allow')
  })
})
