import { stableKey } from '@/lib/stableKey'

describe('stableKey', () => {
  it('is order-independent for object keys', () => {
    expect(stableKey({ a: 1, b: 2 })).toBe(stableKey({ b: 2, a: 1 }))
  })

  it('sorts nested objects recursively', () => {
    expect(stableKey({ x: { p: 1, q: 2 } })).toBe(stableKey({ x: { q: 2, p: 1 } }))
  })

  it('treats undefined/null params as an empty object', () => {
    expect(stableKey(undefined)).toBe('{}')
    expect(stableKey(null)).toBe('{}')
  })

  it('distinguishes different values', () => {
    expect(stableKey({ page: '1' })).not.toBe(stableKey({ page: '2' }))
  })
})
