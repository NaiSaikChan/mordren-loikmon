import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
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
import { firstParam } from '@/lib/normalize'

type Format = 'pdf' | 'epub'

/**
 * Book reader. Takes `id` + `format` and asks the backend for a short-lived
 * signed file URL — the server decides access (LOGIN_REQUIRED / SUBSCRIPTION_REQUIRED).
 */
export default function ReaderScreen() {
  const params = useLocalSearchParams<{ id: string; format?: string; title?: string }>()
  const id = firstParam(params.id)
  const format: Format | undefined = params.format === 'pdf' || params.format === 'epub' ? params.format : undefined
  const title = firstParam(params.title) ?? ''
  const { t } = useI18n()
  const { isDark } = useTheme()
  const { entitlement, user } = useAuth()
  const [url, setUrl] = useState<string | null>(null)
  const [resolvedFormat, setResolvedFormat] = useState<Format | undefined>(format)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gate, setGate] = useState<Exclude<AccessAction, 'open'> | null>(null)
  const [attempt, setAttempt] = useState(0)

  const fetchUrl = useCallback(async () => {
    if (!id) throw new Error(t('reader.notAvailable'))
    const { data } = await booksApi.getFileUrl(id, format)
    setResolvedFormat(data.format)
    return data.url
  }, [id, format, t])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setGate(null)
    fetchUrl()
      .then((signed) => {
        if (active) setUrl(signed)
      })
      .catch((err) => {
        if (!active) return
        const action = actionForErrorCode(errorCode(err))
        if (action && action !== 'open') setGate(action)
        else setError(errorCode(err) === 'NOT_FOUND' ? t('reader.notAvailable') : errorMessage(err, t('common.error')))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // Re-check access after signing in or subscribing from the gate.
  }, [fetchUrl, attempt, user?.id, entitlement?.active, t])

  /**
   * Called by the reader when the signed URL expired (it retries once with the
   * fresh URL itself, so the `source` prop is left unchanged here).
   */
  const refreshUrl = useCallback(async () => {
    try {
      return await fetchUrl()
    } catch {
      return null
    }
  }, [fetchUrl])

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
      <Stack.Screen options={{ title }} />
      {loading && !url ? (
        <LoadingSpinner label={t('reader.loading')} />
      ) : gate ? (
        <View className="flex-1 justify-center p-6">
          <PaywallCard action={gate} />
        </View>
      ) : error || !url ? (
        <View className="flex-1 justify-center p-6">
          <EmptyState icon="📄" title={error ?? t('reader.notAvailable')} />
          <PrimaryButton label={t('common.retry')} variant="ghost" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      ) : (
        <View className="flex-1">
          <DocumentReader
            source={url}
            format={resolvedFormat}
            cacheKey={`book-${id}-${resolvedFormat ?? 'file'}`}
            refreshUrl={refreshUrl}
          />
        </View>
      )}
    </SafeAreaView>
  )
}
