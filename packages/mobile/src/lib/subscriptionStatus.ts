import type { Entitlement, SubscriptionRecord } from '@loikmon/api'

/** Legal documents linked from the paywall (required by App Store / Play review). */
export const TERMS_URL = 'https://loikmon.org/terms'
export const PRIVACY_URL = 'https://loikmon.org/privacy'

export type SubscriptionStateKind =
  | 'none'
  | 'active_renewing'
  | 'active_canceled'
  | 'billing_issue'
  | 'granted'
  | 'paused'
  | 'pending'
  | 'expired'

export interface SubscriptionState {
  kind: SubscriptionStateKind
  /** Renewal / expiry date (ISO) relevant to the state. */
  date: string | null
  /** Store the subscription was bought in (null for grants/manual). */
  store: 'app_store' | 'google_play' | null
  planCode: string | null
  /** True when access comes from a store subscription (plan changes happen in the store). */
  storeManaged: boolean
}

/** Summarise the server's entitlement + subscription history for the paywall/status UI. */
export function describeSubscription(
  entitlement: Entitlement | null | undefined,
  history: SubscriptionRecord[] = [],
): SubscriptionState {
  const sub = entitlement?.subscription ?? history[0] ?? null
  const store = sub?.platform === 'app_store' || sub?.platform === 'google_play' ? sub.platform : null
  const base = {
    date: sub?.expires_at ?? entitlement?.expires_at ?? null,
    store,
    planCode: sub?.plan_code ?? null,
    storeManaged: Boolean(store),
  }

  const inGrace = entitlement?.subscription?.in_grace_period === true
  if (sub && (sub.status === 'grace_period' || sub.status === 'billing_retry' || inGrace)) {
    return { ...base, kind: 'billing_issue' }
  }

  if (entitlement?.active) {
    if (!entitlement.subscription && (entitlement.source === 'grant' || entitlement.source === 'admin')) {
      return { ...base, kind: 'granted', date: entitlement.expires_at, store: null, planCode: null, storeManaged: false }
    }
    if (sub && (sub.status === 'canceled' || !sub.auto_renew)) return { ...base, kind: 'active_canceled' }
    return { ...base, kind: 'active_renewing' }
  }

  switch (sub?.status) {
    case 'paused':
      return { ...base, kind: 'paused' }
    case 'pending':
      return { ...base, kind: 'pending' }
    case 'expired':
    case 'revoked':
    case 'canceled':
      return { ...base, kind: 'expired' }
    default:
      return { ...base, kind: 'none', storeManaged: false }
  }
}

/** Localised short date, tolerant of missing/invalid values. */
export function formatDate(iso: string | null | undefined, locale?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return date.toISOString().slice(0, 10)
  }
}
