import { ScrollView, View, Text, Image, Pressable } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useArticleDetail } from '@/hooks/useArticles'
import { useLibrary } from '@/context/LibraryContext'
import { useI18n } from '@/context/I18nContext'
import { fixUrl } from '@/lib/url'

/** Strips HTML tags for a plain-text fallback render of article bodies. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useI18n()
  const { article, loading, error } = useArticleDetail(id)
  const { isBookmarked, toggleArticle } = useLibrary()

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingSpinner />
      </Screen>
    )
  }

  if (error || !article) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="⚠️" title={t('common.error')} />
      </Screen>
    )
  }

  const thumb = fixUrl(
    (article.thumbnail_url as string) ?? (article.thumbnail as string) ?? '',
  )
  const body = String(article.content ?? article.body ?? article.description ?? '')
  const bookmarked = isBookmarked('article', article.id)

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={() => toggleArticle(article)} hitSlop={8}>
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color="#2563eb"
              />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {thumb ? (
          <Image source={{ uri: thumb }} className="h-56 w-full" resizeMode="cover" />
        ) : null}
        <View className="p-4">
          <Text className="text-2xl font-bold text-surface-900 dark:text-surface-50">
            {article.title}
          </Text>
          {article.author ? (
            <Text className="mt-1 text-surface-500 dark:text-surface-400">
              {t('common.by')} {String(article.author)}
            </Text>
          ) : null}
          <Text className="mt-4 leading-7 text-surface-700 dark:text-surface-200">
            {stripHtml(body)}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  )
}
