import type { EntitlementDto } from './entitlement.js'

export type AccessReason = 'free' | 'subscription' | 'grant' | 'admin' | 'login_required' | 'subscription_required'

export interface AccessDecision {
  granted: boolean
  reason: AccessReason
}

/**
 * Single source of truth for "can this viewer open this item's content?".
 * Free items are open to everyone (no account needed); everything else needs
 * an account with an active entitlement.
 */
export function resolveAccess(input: {
  isFree: boolean
  isAuthenticated: boolean
  entitlement: EntitlementDto | null
}): AccessDecision {
  if (input.isFree) return { granted: true, reason: 'free' }
  if (!input.isAuthenticated) return { granted: false, reason: 'login_required' }
  if (input.entitlement?.active && input.entitlement.source) {
    return { granted: true, reason: input.entitlement.source }
  }
  return { granted: false, reason: 'subscription_required' }
}
