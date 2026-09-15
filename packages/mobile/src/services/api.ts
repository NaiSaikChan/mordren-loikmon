import Constants from 'expo-constants'
import { configureClient, getClient, type ApiError } from '@loikmon/api'
import { DEFAULT_ORIGIN, setMediaOrigin } from '@/lib/url'
import { secureStorage } from './storage'

/**
 * Configures the shared `@loikmon/api` client (Loikmon backend, `/api/v1`).
 *
 * - Base URL: `EXPO_PUBLIC_API_BASE` → app.json `expo.extra.apiBaseUrl` → production.
 *   Local development on the Android emulator: `http://10.0.2.2:4001/api/v1`.
 * - Auth: `Authorization: Bearer <token>`; the token lives in SecureStore
 *   (key `token`) and is cached in memory after the first read.
 * - A 401 for an expired/revoked session signs the user out.
 *
 * Call `initApiClient()` once at app start-up (root layout).
 */
export const PRODUCTION_API_BASE = 'https://api.loikmon.org/api/v1'
export const TOKEN_KEY = 'token'

type Extra = { apiBaseUrl?: string; mediaOrigin?: string } | undefined

export function resolveApiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra
  const base = process.env.EXPO_PUBLIC_API_BASE || extra?.apiBaseUrl || PRODUCTION_API_BASE
  return base.replace(/\/+$/, '')
}

export function resolveMediaOrigin(): string {
  const extra = Constants.expoConfig?.extra as Extra
  return process.env.EXPO_PUBLIC_MEDIA_ORIGIN || extra?.mediaOrigin || DEFAULT_ORIGIN
}

// ── Session token (SecureStore-backed, memory-cached) ─────────────────────

let cachedToken: string | null = null
let tokenLoaded = false
let tokenLoad: Promise<string | null> | null = null

/** Legacy builds stored fake `local:<id>` tokens that the backend never issued. */
export function isUsableToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && token.length > 0 && !token.startsWith('local:')
}

/** Current bearer token: read once from secure storage, then served from memory. */
export async function getSessionToken(): Promise<string | null> {
  if (tokenLoaded) return cachedToken
  tokenLoad ??= secureStorage
    .get(TOKEN_KEY)
    .catch(() => null)
    .then((stored) => {
      // A login/logout that happened while reading wins over the stored value.
      if (!tokenLoaded) {
        cachedToken = isUsableToken(stored) ? stored : null
        tokenLoaded = true
      }
      return cachedToken
    })
  return tokenLoad
}

/** Persist (or clear, with null) the bearer token. */
export async function setSessionToken(token: string | null): Promise<void> {
  cachedToken = isUsableToken(token) ? token : null
  tokenLoaded = true
  if (cachedToken) await secureStorage.set(TOKEN_KEY, cachedToken)
  else await secureStorage.remove(TOKEN_KEY)
}

// ── Unauthorized handling ─────────────────────────────────────────────────

let unauthorizedHandler: ((error: ApiError) => void) | null = null

/** AuthContext registers its sign-out here. */
export function setUnauthorizedHandler(handler: ((error: ApiError) => void) | null): void {
  unauthorizedHandler = handler
}

/**
 * Only a rejected *session* signs the user out. A wrong password on
 * "delete account"/"change password" is also a 401 (INVALID_CREDENTIALS)
 * and must not.
 */
export function isSessionRejected(error: Pick<ApiError, 'status' | 'code'>): boolean {
  return error.status === 401 && (error.code === 'UNAUTHORIZED' || error.code === 'LOGIN_REQUIRED')
}

let initialised = false

export function initApiClient(): void {
  if (initialised) return
  configureClient({
    baseURL: resolveApiBase(),
    getToken: getSessionToken,
    onUnauthorized: (error) => {
      if (isSessionRejected(error)) unauthorizedHandler?.(error)
    },
  })
  setMediaOrigin(resolveMediaOrigin())
  initialised = true
}

export { getClient }
