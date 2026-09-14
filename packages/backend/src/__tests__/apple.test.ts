import { describe, it, expect, vi, beforeEach } from 'vitest'

// Enable Apple so the decode path runs.
vi.stubEnv('APPLE_IAP_ENABLED', 'true')
vi.stubEnv('APPLE_BUNDLE_ID', 'org.loikmon.app')

const { decodeStoreKit2Jws, verifyAppleTransaction } = await import('../services/payments/apple.js')

function makeJws(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}

describe('apple StoreKit2 decode', () => {
  it('decodes a well-formed JWS payload', () => {
    const jws = makeJws({ productId: 'loikmon_sub_monthly', transactionId: '1' })
    expect(decodeStoreKit2Jws(jws).productId).toBe('loikmon_sub_monthly')
  })

  it('throws on malformed JWS', () => {
    expect(() => decodeStoreKit2Jws('not.valid')).toThrow()
  })

  it('maps an active transaction to a verified purchase', async () => {
    const future = Date.now() + 30 * 24 * 3600 * 1000
    const jws = makeJws({
      productId: 'loikmon_sub_monthly',
      transactionId: '1001',
      originalTransactionId: '900',
      expiresDate: future,
      purchaseDate: Date.now(),
      environment: 'Sandbox',
    })
    const result = await verifyAppleTransaction(jws)
    expect(result.provider).toBe('app_store')
    expect(result.planCode).toBe('monthly')
    expect(result.status).toBe('active')
    expect(result.environment).toBe('sandbox')
  })

  it('rejects unknown product ids', async () => {
    const jws = makeJws({ productId: 'unknown', transactionId: '1', originalTransactionId: '1' })
    await expect(verifyAppleTransaction(jws)).rejects.toThrow()
  })
})
