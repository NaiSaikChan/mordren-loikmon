import type { PaymentProvider, SubscriptionStatus } from '../../types/index.js'

/** Normalised result every provider verifier must return. */
export interface VerifiedPurchase {
  provider: PaymentProvider
  planCode: string
  status: SubscriptionStatus
  providerTxnId: string        // stable unique id for idempotency
  originalTxnId: string        // groups renewals
  purchaseToken: string | null
  environment: 'sandbox' | 'production'
  autoRenewing: boolean
  startedAt: Date | null
  expiresAt: Date | null
  rawReceipt: string           // for audit
}

export interface VerifyRequest {
  platform: 'ios' | 'android' | 'web'
  productId?: string
  purchaseToken?: string       // Android
  transactionId?: string       // Apple (StoreKit2) / receipt
  receipt?: string             // Apple legacy base64 receipt
}
