import { getClient } from '../client.js'
import type {
  Entitlement,
  Plan,
  PlansResponse,
  PurchaseProof,
  RestoreResponse,
  SubscriptionStatusResponse,
  VerifyResponse,
} from '../types.js'

/**
 * Subscriptions replace coins: one active plan unlocks every book and article.
 *
 * Purchases are made natively with Google Play Billing / StoreKit (expo-iap);
 * the app then sends the store's proof to the backend, which verifies it with
 * Apple or Google and returns the updated entitlement. Finish the store
 * transaction only after `verify` succeeds.
 */
export const subscriptions = {
  fetchPlans: () => getClient().get<PlansResponse>('subscriptions/plans'),

  /** Entitlement, subscription history, the account token for purchases and store "manage" links. */
  getStatus: () => getClient().get<SubscriptionStatusResponse>('subscriptions/me'),

  /** iOS: `purchase.purchaseToken` from expo-iap (StoreKit 2 JWS). */
  verifyApplePurchase: (transactionJws: string) =>
    getClient().post<VerifyResponse>('subscriptions/verify', { platform: 'ios', transaction_jws: transactionJws }),

  /** Android: `purchase.productId` and `purchase.purchaseToken` from expo-iap. */
  verifyGooglePurchase: (productId: string, purchaseToken: string) =>
    getClient().post<VerifyResponse>('subscriptions/verify', { platform: 'android', product_id: productId, purchase_token: purchaseToken }),

  verify: (proof: PurchaseProof) => getClient().post<VerifyResponse>('subscriptions/verify', proof),

  /** Re-link purchases returned by the store's "restore purchases" (max 20). */
  restore: (purchases: PurchaseProof[]) => getClient().post<RestoreResponse>('subscriptions/restore', { purchases }),
}

/** Whether a catalogue item can be opened, for list badges (the server still enforces access). */
export function isLocked(item: { is_free?: boolean }, entitlement: Entitlement | null | undefined): boolean {
  return !item.is_free && !entitlement?.active
}

/** Store product ids to load with expo-iap `fetchProducts({ skus, type: 'subs' })`. */
export function storeSkus(plans: Plan[], platform: 'ios' | 'android'): string[] {
  const ids = plans.map((p) => (platform === 'ios' ? p.apple_product_id : p.google_product_id)).filter((id): id is string => Boolean(id))
  return [...new Set(ids)]
}

/** "$4.00" — fallback price label when the store's localised price is unavailable (e.g. on web). */
export function formatPlanPrice(plan: Pick<Plan, 'price_cents' | 'currency'>, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency }).format(plan.price_cents / 100)
}
