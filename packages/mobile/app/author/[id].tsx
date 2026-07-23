import { ScrollView, View, Text, Image } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Screen } from '@/components/Screen'
import { BookCard } from '@/components/BookCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useAuthorDetail } from '@/hooks/useAuthors'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { fixUrl } from '@/lib/url'

export default function AuthorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useI18n()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { author, books, loading, error } = useAuthorDetail(id)

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingSpinner />
      </Screen>
    )
  }

  if (error || !author) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="⚠️" title={t('common.error')} />
      </Screen>
    )
  }

  const avatar = fixUrl((author.avatar_url as string) ?? (author.avatar as string) ?? '')

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: author.name }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="items-center px-4 pt-6">
          <View className="h-24 w-24 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
            {avatar ? (
              <Image source={{ uri: avatar }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-3xl">👤</Text>
              </View>
            )}
          </View>
          <Text className="mt-3 text-xl font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
            {author.name}
          </Text>
          <View className="mt-2 flex-row gap-6">
            <View className="items-center">
              <Text className="font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                {t('authors.books', { count: author.books_count ?? books.length })}
              </Text>
            </View>
            <View className="items-center">
              <Text className="font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                {t('authors.followers', { count: author.followers_count ?? 0 })}
              </Text>
            </View>
          </View>
          {author.bio ? (
            <Text className="mt-4 text-center leading-6 text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
              {author.bio}
            </Text>
          ) : null}
        </View>

        <Text className="mb-3 mt-6 px-4 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
          {t('nav.books')}
        </Text>
        <View className="flex-row flex-wrap px-2">
          {books.map((book) => (
            <View key={String(book.id)} className="w-1/3 p-2">
              <BookCard book={book} variant="grid" />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}
