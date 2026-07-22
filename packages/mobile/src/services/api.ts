import Constants from 'expo-constants'
import { getClient } from '@loikmon/api'

/**
 * Configures the shared `@loikmon/api` axios client for React Native.
 *
 * We reuse the exact same client + request interceptor as the web app (which
 * sends POST bodies as text/plain to avoid CORS preflight and wraps them in a
 * `{ data: ... }` envelope). On native there is no CORS, but keeping the shared
 * client guarantees identical request shapes across web and mobile.
 *
 * Call `initApiClient()` once at app startup (see the root layout).
 */
export function resolveApiBase(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE ||
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
    'https://loikmon.org/webapis/'
  )
}

let initialised = false

export function initApiClient(): void {
  if (initialised) return
  // Instantiates (and memoises) the singleton axios client with our base URL.
  getClient(resolveApiBase())
  initialised = true
}

export { getClient }
