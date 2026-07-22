import { View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DocumentReader } from '@/components/DocumentReader'
import { EmptyState } from '@/components/EmptyState'
import { useTheme } from '@/context/ThemeContext'
import { useI18n } from '@/context/I18nContext'

export default function ReaderScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>()
  const { t } = useI18n()
  const { isDark } = useTheme()

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#ffffff' }}
    >
      <Stack.Screen options={{ title: title ?? '' }} />
      {url ? (
        <View className="flex-1">
          <DocumentReader source={url} />
        </View>
      ) : (
        <EmptyState icon="📄" title={t('reader.notAvailable')} />
      )}
    </SafeAreaView>
  )
}
