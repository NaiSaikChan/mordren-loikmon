import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { books as booksApi, errorCode, errorMessage } from '@loikmon/api'
import { DocumentReader } from '@/components/DocumentReader'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PaywallCard } from '@/components/PaywallCard'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useTheme } from '@/context/ThemeContext'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { actionForErrorCode, type AccessAction } from '@/lib/access'
import { documentCacheKey, getCachedDocument } from '@/lib/documentCache'
import { firstParam } from '@/lib/normalize'

type Format = 'pdf' | 'epub'

interface ScreenState {
  /** Which request (book, format, attempt, account) this result answers. */
  request: string
  url: string | null
  format: Format | undefined
  /** Opened from the on-device copy because the server could not be reached. */
  offline: boolean
  error: string | null
  gate: Exclude<AccessAction, 'open'> | null
}

/** Formats to look for in the device cache when the server is unreachable. */
function cachedFormatsToTry(format: Format | undefined): Format[] {
  return format ? [format] : ['epub', 'pdf']
}

async function findCachedFormat(id: string, format: Format | undefined): Promise<Format | null> {
  for (const candidate of cachedFormatsToTry(format)) {
    const hit = await getCachedDocument(documentCacheKey(id, candidate)).catch(() => null)
    if (hit) return candidate
  }
  return null
}

/**
 * Book reader. Takes `id` + `format` and asks the backend for a short-lived
 * signed file URL — the server decides access (LOGIN_REQUIRED / SUBSCRIPTION_REQUIRED).
 * When the server cannot be reached, a copy already on the device is opened
 * instead (offline reading of previously opened books). An access refusal is
 * never bypassed that way.
 */
export default function ReaderScreen() {
  const params = useLocalSearchParams<{ id: string; format?: string; title?: string; version?: string }>()
  const id = firstParam(params.id)
  const format: Format | undefined = params.format === 'pdf' || params.format === 'epub' ? params.format : undefined
  const title = firstParam(params.title) ?? ''
  /** Optional: the book's `updated_at`, so a replaced file is re-downloaded without an ETag check. */
  const version = firstParam(params.version) ?? null
  const { t } = useI18n()
  const { isDark } = useTheme()
  const { entitlement, user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ScreenState | null>(null)

  // Re-check access after signing in or subscribing from the gate.
  const request = `${id ?? ''}|${format ?? ''}|${attempt}|${user?.id ?? ''}|${entitlement?.active ? 1 : 0}`

  const fetchUrl = useCallback(async () => {
    if (!id) throw new Error(t('reader.notAvailable'))
    const { data } = await booksApi.getFileUrl(id, format)
    return { url: data.url, format: data.format }
  }, [id, format, t])

  useEffect(() => {
    let active = true
    const base = { request, url: null, offline: false, error: null, gate: null }
    fetchUrl()
      .then((signed) => {
        if (active) setState({ ...base, url: signed.url, format: signed.format })
      })
      .catch(async (err) => {
        if (!active) return
        const code = errorCode(err)
        const action = actionForErrorCode(code)
        if (action && action !== 'open') {
          setState({ ...base, format, gate: action })
          return
        }
        if (code === 'NOT_FOUND') {
          setState({ ...base, format, error: t('reader.notAvailable') })
          return
        }
        // Unreachable server (offline, timeout, 5xx): fall back to the device copy.
        const cached = id ? await findCachedFormat(id, format) : null
        if (!active) return
        if (cached) setState({ ...base, format: cached, offline: true })
        else setState({ ...base, format, error: errorMessage(err, t('common.error')) })
      })
    return () => {
      active = false
    }
  }, [fetchUrl, request, id, format, t])

  /**
   * Called by the reader when the signed URL expired (it retries once with the
   * fresh URL itself, so the `source` prop is left unchanged here).
   */
  const refreshUrl = useCallback(async () => {
    try {
      return (await fetchUrl()).url
    } catch {
      return null
    }
  }, [fetchUrl])

  const loading = state?.request !== request
  const readable = state && !state.gate && !state.error && (state.url || state.offline)
  const resolvedFormat = state?.format ?? format

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
      <Stack.Screen options={{ title }} />
      {loading && !readable ? (
        <LoadingSpinner label={t('reader.loading')} />
      ) : state?.gate ? (
        <View className="flex-1 justify-center p-6">
          <PaywallCard action={state.gate} />
        </View>
      ) : !readable || !id ? (
        <View className="flex-1 justify-center p-6">
          <EmptyState icon="📄" title={state?.error ?? t('reader.notAvailable')} />
          <PrimaryButton label={t('common.retry')} variant="ghost" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      ) : (
        <View className="flex-1">
          {state?.offline ? (
            <View
              className={isDark ? 'bg-slate-800 px-4 py-2' : 'bg-amber-50 px-4 py-2'}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Text className={isDark ? 'text-center text-xs text-slate-300' : 'text-center text-xs text-amber-900'}>
                {translateOr(t, 'reader.offlineCopy', 'Offline — showing the copy saved on this device.')}
              </Text>
            </View>
          ) : null}
          <DocumentReader
            source={state?.url ?? null}
            format={resolvedFormat}
            cacheKey={resolvedFormat ? documentCacheKey(id, resolvedFormat) : undefined}
            bookId={id}
            version={version}
            refreshUrl={state?.offline ? undefined : refreshUrl}
          />
        </View>
      )}
    </SafeAreaView>
  )
}

/** `t(key)` with an English fallback while the locale files do not have the key yet. */
function translateOr(t: (key: string) => string, key: string, fallback: string): string {
  const value = t(key)
  return value === key ? fallback : value
}
