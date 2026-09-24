import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import { isApiError } from '@loikmon/api'

/**
 * Crash and performance monitoring (Sentry).
 *
 * Enabled only when `EXPO_PUBLIC_SENTRY_DSN` is set, so local development and
 * CI never report. Expected, user-facing failures (4xx API errors, offline)
 * are dropped — they are handled in the UI and would drown real crashes.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
})

let enabled = false

export function initMonitoring(): void {
  if (!DSN || enabled) return
  Sentry.init({
    dsn: DSN,
    environment: Updates.channel || (__DEV__ ? 'development' : 'production'),
    release: Constants.expoConfig?.version,
    dist: Updates.updateId ?? undefined,
    enableAutoSessionTracking: true,
    tracesSampleRate: __DEV__ ? 1 : 0.2,
    // Measures cold/warm start (app start spans) and slow/frozen frames.
    enableNativeFramesTracking: true,
    integrations: [navigationIntegration],
    sendDefaultPii: false,
    beforeSend(event, hint) {
      const err = hint.originalException
      if (isApiError(err) && (err.isNetworkError || (err.status >= 400 && err.status < 500))) return null
      return event
    },
  })
  enabled = true
}

/** Attach the signed-in account (id only — no email or name) to crash reports. */
export function setMonitoringUser(id: string | number | null): void {
  if (!enabled) return
  Sentry.setUser(id == null ? null : { id: String(id) })
}

/** Report a handled error that should still be investigated. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) console.warn('[monitoring]', error, context)
  if (!enabled) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

/**
 * Wrap the root component for error boundaries and app-start timing — only
 * when Sentry is enabled; wrapping before `init` just logs a warning.
 */
export function wrapRoot<P extends Record<string, unknown>>(Root: React.ComponentType<P>): React.ComponentType<P> {
  return DSN ? Sentry.wrap(Root) : Root
}
