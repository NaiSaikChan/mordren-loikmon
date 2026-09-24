import type { Entitlement } from '@loikmon/api'
import { accessAction, accessBadge, actionForErrorCode } from '@/lib/access'

const active: Entitlement = { active: true, source: 'subscription', expires_at: '2026-12-01T00:00:00Z', subscription: null }
const inactive: Entitlement = { active: false, source: null, expires_at: null, subscription: null }

describe('accessBadge (isLocked-based Free / Premium badge)', () => {
  it('free items are always "free"', () => {
    expect(accessBadge({ is_free: true }, null)).toBe('free')
    expect(accessBadge({ is_free: true }, active)).toBe('free')
  })

  it('premium items are locked without an active entitlement', () => {
    expect(accessBadge({ is_free: false }, null)).toBe('premium-locked')
    expect(accessBadge({ is_free: false }, inactive)).toBe('premium-locked')
    expect(accessBadge({}, undefined)).toBe('premium-locked')
    expect(accessBadge({ is_free: '0' as unknown as boolean }, null)).toBe('premium-locked')
  })

  it('premium items are unlocked by an active subscription', () => {
    expect(accessBadge({ is_free: false }, active)).toBe('premium-unlocked')
  })
})

describe('accessAction', () => {
  it('opens content the server granted', () => {
    expect(accessAction({ granted: true, reason: 'subscription' }, true)).toBe('open')
    expect(accessAction({ granted: true, reason: 'free' }, false)).toBe('open')
  })

  it('asks to sign in or subscribe based on the server reason', () => {
    expect(accessAction({ granted: false, reason: 'login_required' }, false)).toBe('login')
    expect(accessAction({ granted: false, reason: 'subscription_required' }, true)).toBe('subscribe')
  })

  it('asks signed-out users to sign in when no decision is available', () => {
    expect(accessAction(null, false)).toBe('login')
    expect(accessAction(undefined, true)).toBe('subscribe')
  })
})

describe('actionForErrorCode', () => {
  it('maps gated API errors to CTAs', () => {
    expect(actionForErrorCode('LOGIN_REQUIRED')).toBe('login')
    expect(actionForErrorCode('SUBSCRIPTION_REQUIRED')).toBe('subscribe')
    expect(actionForErrorCode('NOT_FOUND')).toBeNull()
  })
})
