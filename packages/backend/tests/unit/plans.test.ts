import { describe, expect, it } from 'vitest'
import type { SubscriptionPlan } from '../../src/db/types.js'
import { findPlanForAppleProduct, findPlanForGoogleProduct, serializePlans } from '../../src/domain/plans.js'

const plan = (code: string, cents: number, months: number, order: number): SubscriptionPlan => ({
  code,
  name: code,
  description: null,
  price_cents: cents,
  currency: 'USD',
  period_months: months,
  apple_product_id: `org.loikmon.mobile.premium.${code}`,
  google_product_id: 'loikmon_premium',
  google_base_plan_id: code,
  display_order: order,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
})

const plans = [plan('yearly', 4500, 12, 4), plan('monthly', 400, 1, 1), plan('semiannual', 2000, 6, 3), plan('quarterly', 1000, 3, 2)]

describe('subscription plans', () => {
  it('serialises the four packages in display order with prices and savings', () => {
    const dto = serializePlans(plans)
    expect(dto.map((p) => [p.code, p.price, p.period_months, p.savings_percent])).toEqual([
      ['monthly', '4.00', 1, 0],
      ['quarterly', '10.00', 3, 17],
      ['semiannual', '20.00', 6, 17],
      ['yearly', '45.00', 12, 6],
    ])
  })

  it('maps Apple product ids', () => {
    expect(findPlanForAppleProduct(plans, 'org.loikmon.mobile.premium.quarterly')?.code).toBe('quarterly')
    expect(findPlanForAppleProduct(plans, 'org.loikmon.mobile.coins100')).toBeUndefined()
  })

  it('maps Google product + base plan, and refuses an ambiguous product-only match', () => {
    expect(findPlanForGoogleProduct(plans, 'loikmon_premium', 'yearly')?.code).toBe('yearly')
    expect(findPlanForGoogleProduct(plans, 'loikmon_premium', null)).toBeUndefined()
    const single = [{ ...plan('monthly', 400, 1, 1), google_product_id: 'loikmon_monthly', google_base_plan_id: 'p1m' }]
    expect(findPlanForGoogleProduct(single, 'loikmon_monthly', null)?.code).toBe('monthly')
  })
})
