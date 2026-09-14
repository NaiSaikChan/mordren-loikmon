import { GoogleAuth } from 'google-auth-library'
import { config } from '../../config.js'
import { getPlanByStoreProduct } from '../../domain/plans.js'
import { PaymentError } from '../../utils/errors.js'
import { logger } from '../../utils/logger.js'
import type { VerifiedPurchase } from './types.js'

const ANDROID_PUBLISHER = 'https://androidpublisher.googleapis.com'
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'

let authClient: GoogleAuth | null = null

function getAuth(): GoogleAuth {
  if (!authClient) {
    const creds = config.payments.google.serviceAccountJson
    authClient = new GoogleAuth({
      scopes: [SCOPE],
      credentials: creds ? JSON.parse(creds) : undefined,
    })
  }
  return authClient
}

/**
 * Verify an Android subscription purchase via the Play Developer API v2
 * (purchases.subscriptionsv2.get). Falls back to v1 shape defensively.
 */
export async function verifyGooglePlay(
  productId: string,
  purchaseToken: string,
): Promise<VerifiedPurchase> {
  if (!config.payments.google.enabled) {
    throw new PaymentError('Google Play verification is not configured')
  }
  const plan = getPlanByStoreProduct('android', productId)
  if (!plan) throw new PaymentError(`Unknown Android product: ${productId}`)

  const pkg = config.payments.google.packageName
  const client = await getAuth().getClient()
  const url = `${ANDROID_PUBLISHER}/androidpublisher/v3/applications/${pkg}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`

  let data: any
  try {
    const res = await client.request({ url })
    data = res.data
  } catch (err: any) {
    logger.error({ err: err?.message, productId }, 'Google Play verification request failed')
    throw new PaymentError('Google Play verification failed', err?.message)
  }

  // subscriptionsv2 response shape
  const lineItem = Array.isArray(data.lineItems) ? data.lineItems[0] : undefined
  const expiryStr: string | undefined = lineItem?.expiryTime ?? data.expiryTime
  const startStr: string | undefined = data.startTime
  const state: string = data.subscriptionState ?? ''
  const acknowledged = data.acknowledgementState

  const expiresAt = expiryStr ? new Date(expiryStr) : null
  const active = state === 'SUBSCRIPTION_STATE_ACTIVE' || (expiresAt ? expiresAt > new Date() : false)
  const inGrace = state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'

  return {
    provider: 'google_play',
    planCode: plan.code,
    status: inGrace ? 'grace_period' : active ? 'active' : 'expired',
    providerTxnId: data.latestOrderId ?? purchaseToken,
    originalTxnId: data.linkedPurchaseToken ?? data.latestOrderId ?? purchaseToken,
    purchaseToken,
    environment: data.testPurchase ? 'sandbox' : 'production',
    autoRenewing: lineItem?.autoRenewingPlan?.autoRenewEnabled ?? false,
    startedAt: startStr ? new Date(startStr) : null,
    expiresAt,
    rawReceipt: JSON.stringify(data),
  }
}
