import type { SubscriptionPlan } from '../db/types.js'

/** Public representation of a plan, consumed by the web and mobile paywalls. */
export interface PlanDto {
  code: string
  name: string
  description: string | null
  price_cents: number
  price: string
  currency: string
  period_months: number
  monthly_price_cents: number
  /** Percentage saved compared with paying monthly for the same period. */
  savings_percent: number
  apple_product_id: string | null
  google_product_id: string | null
  google_base_plan_id: string | null
}

export function serializePlan(plan: SubscriptionPlan, monthlyReferenceCents?: number): PlanDto {
  const monthly = Math.round(plan.price_cents / plan.period_months)
  const reference = monthlyReferenceCents ?? monthly
  const savings = reference > 0 ? Math.max(0, Math.round((1 - monthly / reference) * 100)) : 0
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price_cents: plan.price_cents,
    price: (plan.price_cents / 100).toFixed(2),
    currency: plan.currency,
    period_months: plan.period_months,
    monthly_price_cents: monthly,
    savings_percent: savings,
    apple_product_id: plan.apple_product_id,
    google_product_id: plan.google_product_id,
    google_base_plan_id: plan.google_base_plan_id,
  }
}

export function serializePlans(plans: SubscriptionPlan[]): PlanDto[] {
  const sorted = [...plans].sort((a, b) => a.display_order - b.display_order)
  const monthly = sorted.find((p) => p.period_months === 1)
  return sorted.map((p) => serializePlan(p, monthly?.price_cents))
}

export function findPlanForAppleProduct(plans: SubscriptionPlan[], productId: string): SubscriptionPlan | undefined {
  return plans.find((p) => p.apple_product_id === productId)
}

/**
 * Google Play: a plan is identified by product + base plan. When the base plan
 * is unknown (older notifications) fall back to the product id, but only if it
 * maps to exactly one plan.
 */
export function findPlanForGoogleProduct(
  plans: SubscriptionPlan[],
  productId: string,
  basePlanId?: string | null,
): SubscriptionPlan | undefined {
  if (basePlanId) {
    const exact = plans.find((p) => p.google_product_id === productId && p.google_base_plan_id === basePlanId)
    if (exact) return exact
  }
  const byProduct = plans.filter((p) => p.google_product_id === productId)
  return byProduct.length === 1 ? byProduct[0] : undefined
}
