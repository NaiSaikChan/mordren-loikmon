import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DocumentReader } from '@/components/DocumentReader'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/context/ThemeContext'
import { useI18n } from '@/context/I18nContext'
import { books as booksApi } from '@loikmon/api'

export default function ReaderScreen() {
  const { url, title, id } = useLocalSearchParams<{ url: string; title?: string; id?: string }>()
  const { t } = useI18n()
  const { isDark } = useTheme()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    ;(async () => {
      if (id) {
        try {
          await booksApi.updateTotalViews(id)
        } catch {
          // Reader should still work if tracking fails.
        }
      }
      if (active) setReady(true)
    })()

    return () => {
      active = false
    }
  }, [id])

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#ffffff' }}
    >
      <Stack.Screen options={{ title: title ?? '' }} />
      {!ready ? (
        <LoadingSpinner />
      ) : url ? (
        <View className="flex-1">
          <DocumentReader source={url} />
        </View>
      ) : (
        <EmptyState icon="📄" title={t('reader.notAvailable')} />
      )}
    </SafeAreaView>
  )
}
