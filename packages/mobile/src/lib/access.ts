import { isLocked, type AccessInfo, type Entitlement } from '@loikmon/api'

/**
 * Access helpers for list badges and CTAs.
 *
 * These only decide what to *show*: the server enforces access on every file,
 * chapter and article body request (LOGIN_REQUIRED / SUBSCRIPTION_REQUIRED).
 */

export type AccessBadgeKind = 'free' | 'premium-locked' | 'premium-unlocked'

/** Badge for a catalogue item: Free, Premium (locked) or Premium (unlocked by the subscription). */
export function accessBadge(item: { is_free?: boolean }, entitlement: Entitlement | null | undefined): AccessBadgeKind {
  // Strict check: bookmarks cached by the legacy app may hold `is_free: "0"`.
  const free = item.is_free === true
  if (free) return 'free'
  return isLocked({ is_free: free }, entitlement) ? 'premium-locked' : 'premium-unlocked'
}

export type AccessAction = 'open' | 'login' | 'subscribe'

/** What a locked-content CTA should do, based on the server's access decision. */
export function accessAction(access: Pick<AccessInfo, 'granted' | 'reason'> | null | undefined, isLoggedIn: boolean): AccessAction {
  if (access?.granted) return 'open'
  if (access?.reason === 'login_required' || !isLoggedIn) return 'login'
  return 'subscribe'
}

/** Maps an ApiError code from a gated request to the CTA to show. */
export function actionForErrorCode(code: string): AccessAction | null {
  if (code === 'LOGIN_REQUIRED' || code === 'UNAUTHORIZED') return 'login'
  if (code === 'SUBSCRIPTION_REQUIRED') return 'subscribe'
  return null
}

