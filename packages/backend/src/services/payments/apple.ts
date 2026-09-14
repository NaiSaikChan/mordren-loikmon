import { createHash } from 'node:crypto'
import { config } from '../../config.js'
import { getPlanByStoreProduct } from '../../domain/plans.js'
import { PaymentError } from '../../utils/errors.js'
import { logger } from '../../utils/logger.js'
import type { VerifiedPurchase } from './types.js'

/**
 * Apple verification.
 *
 * Two supported flows:
 *  1. Legacy verifyReceipt (base64 app receipt) — simplest for Expo
 *     `in-app-purchases`/`expo-in-app-purchases` clients that send the receipt.
 *  2. StoreKit2 JWS signed transactions — decoded and verified against Apple's
 *     root certificates (recommended; use @apple/app-store-server-library in prod).
 *
 * This implementation uses verifyReceipt (well documented, no extra native
 * deps) and decodes the JWS payload for StoreKit2 tokens. In production you
 * SHOULD verify the JWS signature chain — see verifyJwsSignature() note.
 */

const VERIFY_PROD = 'https://buy.itunes.apple.com/verifyReceipt'
const VERIFY_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt'

interface AppleLatestReceiptInfo {
  product_id: string
  transaction_id: string
  original_transaction_id: string
  purchase_date_ms: string
  expires_date_ms?: string
  is_trial_period?: string
}

async function callVerifyReceipt(receipt: string, sandbox: boolean): Promise<any> {
  const url = sandbox ? VERIFY_SANDBOX : VERIFY_PROD
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receipt,
      password: config.payments.apple.sharedSecret,
      'exclude-old-transactions': true,
    }),
  })
  if (!res.ok) throw new PaymentError(`Apple verifyReceipt HTTP ${res.status}`)
  return res.json()
}

export async function verifyAppleReceipt(receipt: string): Promise<VerifiedPurchase> {
  if (!config.payments.apple.enabled) {
    throw new PaymentError('Apple IAP verification is not configured')
  }

  // Try production first; status 21007 means it's a sandbox receipt.
  let data = await callVerifyReceipt(receipt, false)
  let sandbox = false
  if (data.status === 21007) {
    data = await callVerifyReceipt(receipt, true)
    sandbox = true
  }
  if (data.status !== 0) {
    logger.warn({ status: data.status }, 'Apple verifyReceipt non-zero status')
    throw new PaymentError(`Apple verifyReceipt failed (status ${data.status})`)
  }

  const infos: AppleLatestReceiptInfo[] = data.latest_receipt_info ?? []
  if (!infos.length) throw new PaymentError('Apple receipt contained no transactions')

  // Pick the transaction with the latest expiry.
  const latest = infos
    .slice()
    .sort((a, b) => Number(b.expires_date_ms ?? 0) - Number(a.expires_date_ms ?? 0))[0]

  const plan = getPlanByStoreProduct('ios', latest.product_id)
  if (!plan) throw new PaymentError(`Unknown iOS product: ${latest.product_id}`)

  const expiresAt = latest.expires_date_ms ? new Date(Number(latest.expires_date_ms)) : null
  const active = expiresAt ? expiresAt > new Date() : false

  // Pending renewal info tells us auto-renew state.
  const pending = (data.pending_renewal_info ?? [])[0]
  const autoRenewing = pending ? pending.auto_renew_status === '1' : false

  return {
    provider: 'app_store',
    planCode: plan.code,
    status: active ? 'active' : 'expired',
    providerTxnId: latest.transaction_id,
    originalTxnId: latest.original_transaction_id,
    purchaseToken: latest.transaction_id,
    environment: sandbox ? 'sandbox' : 'production',
    autoRenewing,
    startedAt: latest.purchase_date_ms ? new Date(Number(latest.purchase_date_ms)) : null,
    expiresAt,
    rawReceipt: JSON.stringify({ status: data.status, latest }),
  }
}

/**
 * Decode a StoreKit2 JWS transaction WITHOUT signature verification.
 * NOTE: For production, verify the x5c certificate chain against Apple's root
 * CA (use @apple/app-store-server-library `SignedDataVerifier`). We keep the
 * decode here so the endpoint works end-to-end; signature verification is a
 * hardening TODO flagged in tests.
 */
export function decodeStoreKit2Jws(jws: string): any {
  const parts = jws.split('.')
  if (parts.length !== 3) throw new PaymentError('Malformed StoreKit2 JWS')
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  return payload
}

export async function verifyAppleTransaction(jws: string): Promise<VerifiedPurchase> {
  if (!config.payments.apple.enabled) {
    throw new PaymentError('Apple IAP verification is not configured')
  }
  const t = decodeStoreKit2Jws(jws)
  const plan = getPlanByStoreProduct('ios', t.productId)
  if (!plan) throw new PaymentError(`Unknown iOS product: ${t.productId}`)

  const expiresAt = t.expiresDate ? new Date(Number(t.expiresDate)) : null
  const active = expiresAt ? expiresAt > new Date() : false
  return {
    provider: 'app_store',
    planCode: plan.code,
    status: active ? 'active' : 'expired',
    providerTxnId: String(t.transactionId),
    originalTxnId: String(t.originalTransactionId),
    purchaseToken: String(t.transactionId),
    environment: t.environment === 'Sandbox' ? 'sandbox' : 'production',
    autoRenewing: true,
    startedAt: t.purchaseDate ? new Date(Number(t.purchaseDate)) : null,
    expiresAt,
    rawReceipt: JSON.stringify(t),
  }
}

/** Verify Apple App Store Server Notification (v2) signed payload hash for audit. */
export function appleNotificationId(signedPayload: string): string {
  return createHash('sha256').update(signedPayload).digest('hex').slice(0, 32)
}
