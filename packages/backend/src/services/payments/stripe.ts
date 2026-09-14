import Stripe from 'stripe'
import { config } from '../../config.js'
import { getPlan, PLANS, type PlanCode } from '../../domain/plans.js'
import { PaymentError } from '../../utils/errors.js'
import type { VerifiedPurchase } from './types.js'

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  if (!config.payments.stripe.enabled) {
    throw new PaymentError('Stripe is not configured')
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.payments.stripe.secretKey, { apiVersion: '2024-06-20' as any })
  }
  return stripeClient
}

/** Map our plan code to its configured Stripe price id (via env). */
export function stripePriceIdForPlan(code: PlanCode): string {
  const plan = PLANS[code]
  const priceId = process.env[plan.storeProductIds.stripePriceEnv]
  if (!priceId) throw new PaymentError(`No Stripe price configured for plan ${code}`)
  return priceId
}

/** Create a Checkout Session for a web subscription purchase. */
export async function createCheckoutSession(params: {
  userId: string
  email: string
  planCode: PlanCode
}): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe()
  const plan = getPlan(params.planCode)
  if (!plan) throw new PaymentError(`Unknown plan ${params.planCode}`)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: params.email,
    line_items: [{ price: stripePriceIdForPlan(params.planCode), quantity: 1 }],
    success_url: config.payments.stripe.successUrl,
    cancel_url: config.payments.stripe.cancelUrl,
    client_reference_id: params.userId,
    metadata: { userId: params.userId, planCode: params.planCode },
    subscription_data: { metadata: { userId: params.userId, planCode: params.planCode } },
  })
  if (!session.url) throw new PaymentError('Stripe did not return a checkout URL')
  return { url: session.url, sessionId: session.id }
}

/** Verify + parse a Stripe webhook event. Returns the constructed event. */
export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, config.payments.stripe.webhookSecret)
}

/** Translate a Stripe subscription object into our normalised shape. */
export function subscriptionFromStripe(
  sub: Stripe.Subscription,
  planCode: string,
): VerifiedPurchase {
  const item = sub.items.data[0]
  const expiresAt = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null
  const statusMap: Record<string, VerifiedPurchase['status']> = {
    active: 'active',
    trialing: 'active',
    past_due: 'grace_period',
    canceled: 'canceled',
    unpaid: 'expired',
    incomplete: 'pending',
    incomplete_expired: 'expired',
  }
  return {
    provider: 'stripe',
    planCode,
    status: statusMap[sub.status] ?? 'pending',
    providerTxnId: sub.id,
    originalTxnId: sub.id,
    purchaseToken: (item?.id ?? null),
    environment: sub.livemode ? 'production' : 'sandbox',
    autoRenewing: !sub.cancel_at_period_end,
    startedAt: sub.start_date ? new Date(sub.start_date * 1000) : null,
    expiresAt,
    rawReceipt: JSON.stringify({ id: sub.id, status: sub.status }),
  }
}
