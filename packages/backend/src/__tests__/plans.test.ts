import { describe, it, expect } from 'vitest'
import {
  PLANS,
  PLAN_LIST,
  getPlan,
  getPlanByStoreProduct,
  computeExpiry,
} from '../domain/plans.js'

describe('subscription plans', () => {
  it('defines exactly the four required plans with correct prices', () => {
    expect(PLANS.monthly.priceUsd).toBe(4)
    expect(PLANS.quarterly.priceUsd).toBe(10)
    expect(PLANS.semiannual.priceUsd).toBe(20)
    expect(PLANS.yearly.priceUsd).toBe(45)
  })

  it('has correct durations', () => {
    expect(PLANS.monthly.durationDays).toBe(30)
    expect(PLANS.quarterly.durationDays).toBe(90)
    expect(PLANS.semiannual.durationDays).toBe(180)
    expect(PLANS.yearly.durationDays).toBe(365)
  })

  it('lists plans in display order', () => {
    expect(PLAN_LIST.map((p) => p.code)).toEqual(['monthly', 'quarterly', 'semiannual', 'yearly'])
  })

  it('resolves plans by code', () => {
    expect(getPlan('yearly')?.name).toBe('Yearly')
    expect(getPlan('nonsense')).toBeUndefined()
  })

  it('reverse-resolves plans by store product id', () => {
    expect(getPlanByStoreProduct('android', 'loikmon_sub_monthly')?.code).toBe('monthly')
    expect(getPlanByStoreProduct('ios', 'loikmon_sub_yearly')?.code).toBe('yearly')
    expect(getPlanByStoreProduct('android', 'unknown')).toBeUndefined()
  })

  it('computes expiry correctly from a base date', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const exp = computeExpiry(PLANS.monthly, from)
    expect(exp.toISOString()).toBe('2026-01-31T00:00:00.000Z')
  })
})
