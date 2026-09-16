import { describe, expect, it } from 'vitest'
import { fillSeries, resolveRange } from '../../src/services/cms/analytics.js'
import { canTransition, tagSlug } from '../../src/services/cms/content.js'
import { computeDiscountCents, generateCouponCode, normaliseCouponCode } from '../../src/services/cms/coupons.js'
import { slugify } from '../../src/services/cms/policies.js'
import { diffSnapshots, redactSnapshot } from '../../src/services/audit.js'

describe('coupon discounts', () => {
  const percent = (value: number, cap: number | null = null) =>
    ({ discount_type: 'percent' as const, discount_value: value, max_discount_cents: cap })
  const fixed = (value: number) => ({ discount_type: 'fixed' as const, discount_value: value, max_discount_cents: null })

  it('takes a percentage of the order', () => {
    expect(computeDiscountCents(percent(25), 1000)).toBe(250)
    expect(computeDiscountCents(percent(100), 1000)).toBe(1000)
  })

  it('rounds to the nearest cent', () => {
    expect(computeDiscountCents(percent(33), 1000)).toBe(330)
    expect(computeDiscountCents(percent(15), 333)).toBe(50) // 49.95 → 50
  })

  it('honours a maximum discount cap', () => {
    expect(computeDiscountCents(percent(50, 200), 1000)).toBe(200)
    expect(computeDiscountCents(percent(50, 900), 1000)).toBe(500)
  })

  it('never discounts more than the order is worth', () => {
    expect(computeDiscountCents(fixed(5000), 1000)).toBe(1000)
  })

  it('returns nothing for an empty order', () => {
    expect(computeDiscountCents(percent(50), 0)).toBe(0)
    expect(computeDiscountCents(fixed(100), -50)).toBe(0)
  })
})

describe('coupon codes', () => {
  it('uppercases and strips punctuation', () => {
    expect(normaliseCouponCode(' spring-25! ')).toBe('SPRING-25')
    expect(normaliseCouponCode('a b c')).toBe('ABC')
  })

  it('caps the length at the column width', () => {
    expect(normaliseCouponCode('x'.repeat(100))).toHaveLength(48)
  })

  it('generates codes without characters that are easy to misread', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateCouponCode()
      expect(code).toHaveLength(10)
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/) // no I, O, 0, 1
    }
  })
})

describe('editorial workflow', () => {
  it('allows the normal path from draft to published', () => {
    expect(canTransition('draft', 'in_review')).toBe(true)
    expect(canTransition('in_review', 'published')).toBe(true)
    expect(canTransition('published', 'archived')).toBe(true)
    expect(canTransition('archived', 'draft')).toBe(true)
  })

  it('treats a no-op as valid', () => {
    expect(canTransition('published', 'published')).toBe(true)
  })

  it('refuses to resurrect archived content straight into review or publication', () => {
    expect(canTransition('archived', 'published')).toBe(false)
    expect(canTransition('archived', 'in_review')).toBe(false)
  })

  it('refuses to send published content back for review', () => {
    expect(canTransition('published', 'in_review')).toBe(false)
    expect(canTransition('published', 'scheduled')).toBe(false)
  })
})

describe('slugs', () => {
  it('builds url-safe policy slugs', () => {
    expect(slugify('Terms & Conditions')).toBe('terms-conditions')
    expect(slugify('  Refund Policy  ')).toBe('refund-policy')
  })

  it('keeps non-latin letters in tags, since the catalogue is in Mon', () => {
    expect(tagSlug('ဘာသာစကား')).toBe('ဘာသာစကား')
    expect(tagSlug('Short Stories')).toBe('short-stories')
  })
})

describe('audit snapshots', () => {
  it('redacts anything that looks like a secret', () => {
    const out = redactSnapshot({ email: 'a@b.test', password: 'hunter2', purchase_token: 'x', nested: { api_secret: 'y' } })
    expect(out).toMatchObject({
      email: 'a@b.test',
      password: '[redacted]',
      nested: { api_secret: '[redacted]' },
    })
  })

  it('shortens long text so one entry cannot bloat the table', () => {
    const out = redactSnapshot({ body: 'x'.repeat(5000) }) as { body: string }
    expect(out.body.length).toBeLessThanOrEqual(2001)
  })

  it('serialises dates', () => {
    const out = redactSnapshot({ at: new Date('2026-01-02T03:04:05Z') }) as { at: string }
    expect(out.at).toBe('2026-01-02T03:04:05.000Z')
  })

  it('records only the fields that changed', () => {
    const before = { title: 'Old', status: 'draft', views: 5 }
    const after = { title: 'New', status: 'draft', views: 5 }
    expect(diffSnapshots(before, after)).toEqual({ before: { title: 'Old' }, after: { title: 'New' } })
  })

  it('compares dates by value, not by identity', () => {
    const at = '2026-01-01T00:00:00.000Z'
    const diff = diffSnapshots({ at: new Date(at) }, { at: new Date(at) })
    expect(diff.after).toEqual({})
  })
})

describe('analytics ranges', () => {
  const now = new Date('2026-03-31T12:00:00Z')

  it('defaults to the requested number of days back from now', () => {
    const range = resolveRange({ days: 7 }, now)
    expect(range.to).toEqual(now)
    expect(range.from.toISOString()).toBe('2026-03-24T12:00:00.000Z')
  })

  it('prefers explicit bounds', () => {
    const range = resolveRange({ from: '2026-01-01T00:00:00Z', to: '2026-01-31T00:00:00Z' }, now)
    expect(range.from.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-01-31T00:00:00.000Z')
  })

  it('fills days with no data so a chart has no gaps', () => {
    const range = { from: new Date('2026-03-01T00:00:00Z'), to: new Date('2026-03-05T00:00:00Z') }
    const series = fillSeries([{ date: '2026-03-03', value: 7 }], range)
    expect(series).toEqual([
      { date: '2026-03-01', value: 0 },
      { date: '2026-03-02', value: 0 },
      { date: '2026-03-03', value: 7 },
      { date: '2026-03-04', value: 0 },
      { date: '2026-03-05', value: 0 },
    ])
  })

  it('stops well short of runaway output for an absurd range', () => {
    const range = { from: new Date('2000-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') }
    expect(fillSeries([], range).length).toBeLessThanOrEqual(400)
  })
})
