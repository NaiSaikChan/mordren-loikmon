/**
 * Subscription plan catalogue.
 *
 * The platform moved from a coin-based, per-item purchase model to a flat
 * subscription that unlocks ALL books and articles while active.
 *
 * Prices (USD):
 *   - Monthly    : $4   / 1 month
 *   - Quarterly  : $10  / 3 months
 *   - Half-year  : $20  / 6 months
 *   - Yearly     : $45  / 12 months
 *
 * `storeProductIds` map our internal plan code to the product identifiers
 * configured in Google Play Console and App Store Connect. These MUST match
 * the store configuration exactly. Web billing uses Stripe price IDs.
 */

export type PlanCode = 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export interface SubscriptionPlan {
  code: PlanCode
  name: string
  priceUsd: number
  durationDays: number
  /** Store product identifiers, keyed by platform. */
  storeProductIds: {
    android: string
    ios: string
    stripePriceEnv: string // name of env var holding the Stripe price id
  }
  displayOrder: number
}

export const PLANS: Record<PlanCode, SubscriptionPlan> = {
  monthly: {
    code: 'monthly',
    name: 'Monthly',
    priceUsd: 4,
    durationDays: 30,
    storeProductIds: {
      android: 'loikmon_sub_monthly',
      ios: 'loikmon_sub_monthly',
      stripePriceEnv: 'STRIPE_PRICE_MONTHLY',
    },
    displayOrder: 1,
  },
  quarterly: {
    code: 'quarterly',
    name: '3 Months',
    priceUsd: 10,
    durationDays: 90,
    storeProductIds: {
      android: 'loikmon_sub_quarterly',
      ios: 'loikmon_sub_quarterly',
      stripePriceEnv: 'STRIPE_PRICE_QUARTERLY',
    },
    displayOrder: 2,
  },
  semiannual: {
    code: 'semiannual',
    name: '6 Months',
    priceUsd: 20,
    durationDays: 180,
    storeProductIds: {
      android: 'loikmon_sub_semiannual',
      ios: 'loikmon_sub_semiannual',
      stripePriceEnv: 'STRIPE_PRICE_SEMIANNUAL',
    },
    displayOrder: 3,
  },
  yearly: {
    code: 'yearly',
    name: 'Yearly',
    priceUsd: 45,
    durationDays: 365,
    storeProductIds: {
      android: 'loikmon_sub_yearly',
      ios: 'loikmon_sub_yearly',
      stripePriceEnv: 'STRIPE_PRICE_YEARLY',
    },
    displayOrder: 4,
  },
}

export const PLAN_LIST: SubscriptionPlan[] = Object.values(PLANS).sort(
  (a, b) => a.displayOrder - b.displayOrder,
)

/** Resolve a plan by our internal code. */
export function getPlan(code: string): SubscriptionPlan | undefined {
  return (PLANS as Record<string, SubscriptionPlan>)[code]
}

/** Reverse-lookup: given a store product id + platform, find the plan. */
export function getPlanByStoreProduct(
  platform: 'android' | 'ios',
  productId: string,
): SubscriptionPlan | undefined {
  return PLAN_LIST.find((p) => p.storeProductIds[platform] === productId)
}

/** Compute an expiry date from "now" for a given plan (fallback when store gives none). */
export function computeExpiry(plan: SubscriptionPlan, from: Date = new Date()): Date {
  return new Date(from.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
}
