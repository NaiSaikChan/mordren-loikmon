export type Platform = 'ios' | 'android' | 'web'
export type PaymentProvider = 'google_play' | 'app_store' | 'stripe'
export type SubscriptionStatus = 'active' | 'expired' | 'canceled' | 'grace_period' | 'pending'

export interface AuthUser {
  id: string
  email: string
  is_admin: boolean
}

/** A normalised entitlement resolved from an active subscription. */
export interface Entitlement {
  active: boolean
  planCode: string | null
  status: SubscriptionStatus | null
  expiresAt: string | null
  provider: PaymentProvider | null
}

// Augment Express Request with our auth context.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
      entitlement?: Entitlement
    }
  }
}
