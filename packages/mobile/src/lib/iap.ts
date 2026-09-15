import { errorCode, formatPlanPrice, isApiError } from '@loikmon/api'
import type { Entitlement, Plan, PurchaseProof, RestoreResponse, SubscriptionStatusResponse } from '@loikmon/api'
// Type-only: this module stays pure (no native module access) so it can be unit-tested.
import type {
  ProductSubscription,
  Purchase,
  PurchaseAndroid,
  PurchaseIOS,
  RequestPurchaseProps,
  SubscriptionOffer,
} from 'expo-iap'

/**
 * Pure helpers for native store subscriptions (expo-iap ⇄ Loikmon backend).
 *
 * Flow: requestPurchase → store sheet → purchase event → `processPurchase`:
 * verify the store proof with the backend → **only then** finish the store
 * transaction. The backend, never the app, decides entitlement.
 */

export type StorePlatform = 'ios' | 'android'

/** Backend verification is limited to 20 purchases per restore call. */
export const MAX_RESTORE_PROOFS = 20

export function storePlatformOf(os: string): StorePlatform | null {
  return os === 'ios' || os === 'android' ? os : null
}

// ── Proofs ────────────────────────────────────────────────────────────────

/**
 * The proof the backend verifies with Apple/Google.
 * iOS: expo-iap `purchaseToken` is the StoreKit 2 JWS representation.
 * Android: product id + Play purchase token.
 */
export function buildPurchaseProof(
  purchase: Pick<Purchase, 'productId' | 'purchaseToken'>,
  platform: StorePlatform,
): PurchaseProof | null {
  const token = purchase.purchaseToken?.trim()
  if (!token) return null
  if (platform === 'ios') return { platform: 'ios', transaction_jws: token }
  if (!purchase.productId) return null
  return { platform: 'android', product_id: purchase.productId, purchase_token: token }
}

/**
 * Stable key identifying a store purchase across app launches:
 * the StoreKit transaction id on iOS (the JWS is large), the Play purchase
 * token on Android (order ids change on every renewal).
 */
export function purchaseKey(purchase: Purchase, platform: StorePlatform): string {
  if (platform === 'ios') {
    return String((purchase as PurchaseIOS).transactionId || purchase.id || purchase.purchaseToken || purchase.productId)
  }
  return String(purchase.purchaseToken || purchase.id || purchase.productId)
}

export const STORE_MANAGE_URLS = {
  app_store: 'https://apps.apple.com/account/subscriptions',
  google_play: 'https://play.google.com/store/account/subscriptions',
} as const

/**
 * Where the user manages (cancels, fixes payment for) their subscription:
 * the store the current subscription was bought in, otherwise this device's store.
 */
export function resolveManageUrl(
  status: Pick<SubscriptionStatusResponse, 'entitlement' | 'subscriptions' | 'manage_urls'> | null | undefined,
  platform: StorePlatform | null,
): string | null {
  const sub = status?.entitlement.subscription ?? status?.subscriptions?.[0] ?? null
  const store =
    sub?.platform === 'app_store' || sub?.platform === 'google_play'
      ? sub.platform
      : platform === 'ios'
        ? 'app_store'
        : platform === 'android'
          ? 'google_play'
          : null
  if (!store) return null
  return status?.manage_urls?.[store] || STORE_MANAGE_URLS[store]
}

// ── Products & offers ─────────────────────────────────────────────────────

/**
 * Pick the Play Billing offer for a base plan of the single `loikmon_premium`
 * subscription product. Prefers the plain base-plan offer (no offerId — i.e.
 * its id is empty or equals the base plan id) over promotional offers.
 */
export function pickAndroidOffer(
  product: { subscriptionOffers?: SubscriptionOffer[] | null } | null | undefined,
  basePlanId: string | null | undefined,
): SubscriptionOffer | null {
  const offers = (product?.subscriptionOffers ?? []).filter((offer) => Boolean(offer.offerTokenAndroid))
  const forPlan = basePlanId ? offers.filter((offer) => offer.basePlanIdAndroid === basePlanId) : offers
  if (forPlan.length === 0) return null
  const isBaseOffer = (offer: SubscriptionOffer) => !offer.id || offer.id === offer.basePlanIdAndroid
  const singlePhase = (offer: SubscriptionOffer) => (offer.pricingPhasesAndroid?.pricingPhaseList?.length ?? 1) <= 1
  return forPlan.find(isBaseOffer) ?? forPlan.find(singlePhase) ?? forPlan[0]
}

/** Localised recurring price of an Android offer (last pricing phase = the renewal price). */
export function androidOfferPrice(offer: SubscriptionOffer | null | undefined): string | null {
  if (!offer) return null
  const phases = offer.pricingPhasesAndroid?.pricingPhaseList ?? []
  const recurring = phases.length > 0 ? phases[phases.length - 1] : null
  return recurring?.formattedPrice || offer.displayPrice || null
}

export interface PlanOffer {
  plan: Plan
  /** Store product id (iOS product / Android subscription product). */
  productId: string | null
  /** Android base plan id. */
  basePlanId: string | null
  /** Android offer token required by Play Billing. */
  offerToken: string | null
  /** Localised store price when available, otherwise the backend's USD price. */
  displayPrice: string
  priceFromStore: boolean
  /** The store returned this product/offer, so it can be purchased on this device. */
  available: boolean
  /** Highest savings among the plans. */
  bestValue: boolean
}

/** Plans from the backend merged with the products the store returned. */
export function mergePlansWithProducts(
  plans: Plan[],
  products: ProductSubscription[],
  platform: StorePlatform | null,
  locale?: string,
): PlanOffer[] {
  const bestCode = bestValuePlanCode(plans)
  return plans.map((plan) => {
    const fallbackPrice = safeFormatPlanPrice(plan, locale)
    const base: PlanOffer = {
      plan,
      productId: null,
      basePlanId: null,
      offerToken: null,
      displayPrice: fallbackPrice,
      priceFromStore: false,
      available: false,
      bestValue: plan.code === bestCode,
    }
    if (platform === 'ios') {
      const productId = plan.apple_product_id
      const product = productId ? products.find((p) => p.id === productId) : undefined
      return {
        ...base,
        productId,
        displayPrice: product?.displayPrice || fallbackPrice,
        priceFromStore: Boolean(product?.displayPrice),
        available: Boolean(product),
      }
    }
    if (platform === 'android') {
      const productId = plan.google_product_id
      const product = productId ? products.find((p) => p.id === productId) : undefined
      const offer = product ? pickAndroidOffer(product, plan.google_base_plan_id) : null
      const storePrice = androidOfferPrice(offer)
      return {
        ...base,
        productId,
        basePlanId: plan.google_base_plan_id,
        offerToken: offer?.offerTokenAndroid ?? null,
        displayPrice: storePrice || fallbackPrice,
        priceFromStore: Boolean(storePrice),
        available: Boolean(offer?.offerTokenAndroid),
      }
    }
    return base
  })
}

/**
 * The single plan to highlight: highest savings, then lowest monthly price,
 * then the longest period. Null when no plan saves anything.
 */
export function bestValuePlanCode(plans: Plan[]): string | null {
  const candidates = plans.filter((plan) => (plan.savings_percent || 0) > 0)
  if (candidates.length === 0) return null
  const best = [...candidates].sort(
    (a, b) =>
      b.savings_percent - a.savings_percent ||
      a.monthly_price_cents - b.monthly_price_cents ||
      b.period_months - a.period_months,
  )[0]
  return best.code
}

function safeFormatPlanPrice(plan: Plan, locale?: string): string {
  try {
    return formatPlanPrice(plan, locale)
  } catch {
    return `${plan.price} ${plan.currency}`
  }
}

/**
 * The expo-iap subscription request for a plan. The account token (the user's
 * UUID from `subscriptions.getStatus()`) is embedded so the store transaction
 * can only be linked to this Loikmon account.
 */
export function buildSubscriptionRequest(
  offer: PlanOffer,
  platform: StorePlatform,
  accountToken: string,
): RequestPurchaseProps | null {
  if (!offer.productId || !accountToken) return null
  if (platform === 'ios') {
    return { type: 'subs', request: { apple: { sku: offer.productId, appAccountToken: accountToken } } }
  }
  if (!offer.offerToken) return null
  return {
    type: 'subs',
    request: {
      google: {
        skus: [offer.productId],
        subscriptionOffers: [{ sku: offer.productId, offerToken: offer.offerToken }],
        obfuscatedAccountId: accountToken,
      },
    },
  }
}

// ── Verification ──────────────────────────────────────────────────────────

const RETRYABLE_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'STORE_UNAVAILABLE',
  'STORE_NOT_CONFIGURED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
  'RATE_LIMITED',
  // Not signed in (yet): verify again once a session exists.
  'UNAUTHORIZED',
  'LOGIN_REQUIRED',
])

/**
 * Whether a verification failure is transient. The transaction then stays
 * unfinished and is verified again on the next launch / foreground.
 */
export function isRetryableVerifyError(err: unknown): boolean {
  if (!isApiError(err)) return true // unexpected client-side failure: never lose the purchase
  return err.status === 0 || err.status === 429 || err.status >= 500 || RETRYABLE_CODES.has(err.code)
}

export function isUserCancelled(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  return code === 'user-cancelled' || code === 'E_USER_CANCELLED'
}

export type PurchaseOutcome =
  | { status: 'verified'; entitlement: Entitlement; finished: boolean }
  | { status: 'pending' }
  | { status: 'retry'; code: string; error: unknown }
  | { status: 'rejected'; code: string; error: unknown }

export interface ProcessPurchaseDeps {
  platform: StorePlatform
  verify: (proof: PurchaseProof) => Promise<{ entitlement: Entitlement }>
  finishTransaction: (args: { purchase: Purchase; isConsumable: boolean }) => Promise<unknown>
  onFinishError?: (error: unknown) => void
}

/**
 * Verify a store purchase with the backend, then finish the store transaction.
 *
 * - Pending (e.g. Play "slow card"/cash) purchases are left alone until they complete.
 * - The transaction is finished **only after** the backend accepted the proof.
 * - Transient failures (`retry`) keep the transaction unfinished for a later retry.
 * - Definitive rejections (`rejected`, e.g. PURCHASE_ALREADY_LINKED) are not finished either.
 */
export async function processPurchase(purchase: Purchase, deps: ProcessPurchaseDeps): Promise<PurchaseOutcome> {
  if (purchase.purchaseState === 'pending') return { status: 'pending' }

  const proof = buildPurchaseProof(purchase, deps.platform)
  if (!proof) return { status: 'rejected', code: 'PURCHASE_TOKEN_MISSING', error: new Error('Purchase has no token') }

  let entitlement: Entitlement
  try {
    ;({ entitlement } = await deps.verify(proof))
  } catch (error) {
    const code = errorCode(error)
    return isRetryableVerifyError(error) ? { status: 'retry', code, error } : { status: 'rejected', code, error }
  }

  let finished = true
  try {
    await deps.finishTransaction({ purchase, isConsumable: false })
  } catch (error) {
    // The entitlement is already granted server-side; the unfinished transaction
    // will be delivered again and re-verified idempotently.
    finished = false
    deps.onFinishError?.(error)
  }
  return { status: 'verified', entitlement, finished }
}

/**
 * Purchases that still need backend verification: those remembered after a
 * transient failure, plus (Android) any subscription Play reports as not yet
 * acknowledged. iOS re-delivers unfinished transactions to the purchase
 * listener on launch by itself.
 */
export function selectRetryCandidates(
  purchases: Purchase[],
  pendingKeys: ReadonlySet<string>,
  platform: StorePlatform,
  skus: ReadonlySet<string>,
): Purchase[] {
  return purchases.filter((purchase) => {
    if (!skus.has(purchase.productId)) return false
    if (purchase.purchaseState === 'pending') return false
    if (pendingKeys.has(purchaseKey(purchase, platform))) return true
    return platform === 'android' && (purchase as PurchaseAndroid).isAcknowledgedAndroid === false
  })
}

export interface RestoreOutcome {
  entitlement: Entitlement | null
  restored: number
  nothingToRestore: boolean
  alreadyLinked: boolean
  failures: Array<{ code?: string; message?: string }>
}

export interface RestoreDeps {
  platform: StorePlatform
  skus: ReadonlySet<string>
  restore: (proofs: PurchaseProof[]) => Promise<Pick<RestoreResponse, 'entitlement' | 'results'>>
  finishTransaction: (args: { purchase: Purchase; isConsumable: boolean }) => Promise<unknown>
}

/** "Restore purchases": re-link the store's purchases to the signed-in account, finishing the ones the backend accepted. */
export async function restoreWithBackend(purchases: Purchase[], deps: RestoreDeps): Promise<RestoreOutcome> {
  const seen = new Set<string>()
  const pairs: Array<{ purchase: Purchase; proof: PurchaseProof }> = []
  for (const purchase of purchases) {
    if (!deps.skus.has(purchase.productId) || purchase.purchaseState === 'pending') continue
    const proof = buildPurchaseProof(purchase, deps.platform)
    if (!proof) continue
    const key = proof.platform === 'ios' ? proof.transaction_jws : proof.purchase_token
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push({ purchase, proof })
    if (pairs.length >= MAX_RESTORE_PROOFS) break
  }

  if (pairs.length === 0) {
    return { entitlement: null, restored: 0, nothingToRestore: true, alreadyLinked: false, failures: [] }
  }

  const response = await deps.restore(pairs.map((pair) => pair.proof))
  let restored = 0
  const failures: RestoreOutcome['failures'] = []
  for (let i = 0; i < pairs.length; i++) {
    const result = response.results[i]
    if (result?.ok) {
      restored++
      await deps.finishTransaction({ purchase: pairs[i].purchase, isConsumable: false }).catch(() => undefined)
    } else if (result) {
      failures.push({ code: result.code, message: result.message })
    }
  }
  return {
    entitlement: response.entitlement,
    restored,
    nothingToRestore: false,
    alreadyLinked: failures.some((failure) => failure.code === 'PURCHASE_ALREADY_LINKED'),
    failures,
  }
}
