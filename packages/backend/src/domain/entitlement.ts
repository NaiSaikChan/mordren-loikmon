import type { EntitlementGrant, Platform, Subscription, SubscriptionStatus } from '../db/types.js'

/**
 * Entitlement = "may this user open paid books and articles right now?".
 * A single active subscription (from any store) or an admin grant unlocks the
 * whole catalogue; there are no per-item purchases.
 */

export type EntitlementSource = 'subscription' | 'grant' | 'admin'

export interface EntitlementDto {
  active: boolean
  source: EntitlementSource | null
  expires_at: string | null
  subscription: {
    id: string
    plan_code: string | null
    platform: Platform
    status: SubscriptionStatus
    auto_renew: boolean
    expires_at: string | null
    in_grace_period: boolean
    environment: string
    product_id: string | null
  } | null
}

export const NO_ENTITLEMENT: EntitlementDto = Object.freeze({
  active: false,
  source: null,
  expires_at: null,
  subscription: null,
}) as EntitlementDto

/** Statuses that can still grant access (subject to the expiry check). */
const ACCESS_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(['active', 'canceled', 'grace_period'])

/** When access provided by this subscription ends, or null when it grants none now. */
export function accessUntil(sub: Pick<Subscription, 'status' | 'expires_at' | 'grace_expires_at'>, now: Date): Date | null {
  if (!ACCESS_STATUSES.has(sub.status)) return null
  const end = sub.status === 'grace_period' ? (sub.grace_expires_at ?? sub.expires_at) : sub.expires_at
  if (!end) return null
  return end.getTime() > now.getTime() ? end : null
}

export function grantIsActive(grant: Pick<EntitlementGrant, 'starts_at' | 'expires_at' | 'revoked_at'>, now: Date): boolean {
  if (grant.revoked_at) return false
  if (grant.starts_at.getTime() > now.getTime()) return false
  return grant.expires_at === null || grant.expires_at.getTime() > now.getTime()
}

export function computeEntitlement(input: {
  role?: string | null
  subscriptions: Subscription[]
  grants: EntitlementGrant[]
  now?: Date
}): EntitlementDto {
  const now = input.now ?? new Date()

  // Pick the subscription giving the longest access; if none gives access,
  // still surface the most recent one so clients can explain why (expired,
  // billing retry, ...).
  let best: { sub: Subscription; until: Date } | null = null
  for (const sub of input.subscriptions) {
    const until = accessUntil(sub, now)
    if (until && (!best || until > best.until)) best = { sub, until }
  }
  const latest =
    best?.sub ??
    [...input.subscriptions].sort((a, b) => (b.expires_at?.getTime() ?? 0) - (a.expires_at?.getTime() ?? 0))[0] ??
    null

  const subscriptionDto = latest
    ? {
        id: latest.id,
        plan_code: latest.plan_code,
        platform: latest.platform,
        status: latest.status,
        auto_renew: latest.auto_renew,
        expires_at: latest.expires_at?.toISOString() ?? null,
        in_grace_period: latest.status === 'grace_period',
        environment: latest.environment,
        product_id: latest.product_id,
      }
    : null

  if (best) {
    return { active: true, source: 'subscription', expires_at: best.until.toISOString(), subscription: subscriptionDto }
  }

  const activeGrants = input.grants.filter((g) => grantIsActive(g, now))
  if (activeGrants.length) {
    const unlimited = activeGrants.some((g) => g.expires_at === null)
    const until = unlimited ? null : new Date(Math.max(...activeGrants.map((g) => g.expires_at!.getTime())))
    return { active: true, source: 'grant', expires_at: until?.toISOString() ?? null, subscription: subscriptionDto }
  }

  if (input.role === 'admin') {
    return { active: true, source: 'admin', expires_at: null, subscription: subscriptionDto }
  }

  return { ...NO_ENTITLEMENT, subscription: subscriptionDto }
}
