import { errorCode, isApiError } from '@loikmon/api'
import type { AccessInfo } from '@loikmon/api'

/** Why a piece of content is locked. The server decides; the UI only renders the right call to action. */
export type LockReason = 'login_required' | 'subscription_required'

export function lockReasonFromAccess(access: AccessInfo | null | undefined): LockReason | null {
  if (!access || access.granted) return null
  return access.reason === 'login_required' ? 'login_required' : 'subscription_required'
}

/** Maps LOGIN_REQUIRED / SUBSCRIPTION_REQUIRED API errors to a lock reason (null for any other error). */
export function lockReasonFromError(err: unknown): LockReason | null {
  const code = errorCode(err)
  if (code === 'LOGIN_REQUIRED' || code === 'UNAUTHORIZED') return 'login_required'
  if (code === 'SUBSCRIPTION_REQUIRED') return 'subscription_required'
  if (isApiError(err) && err.status === 401) return 'login_required'
  return null
}

/** Only allow same-app redirects (`/path`), never `//host` or absolute URLs. */
export function safeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
