import { View, Text, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { EmptyState } from '@/components/EmptyState'
import { useLibrary } from '@/context/LibraryContext'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'

function PremiumPrompt() {
  const { t } = useI18n()
  const { headerTextStyle, bodyTextStyle } = useTypography()
  return (
    <Pressable
      onPress={() => router.push('/subscribe')}
      className="mx-4 mt-3 flex-row items-center rounded-2xl bg-brand-600 p-4"
      accessibilityRole="button"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/20">
        <Ionicons name="diamond-outline" size={20} color="#ffffff" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-base text-white" style={headerTextStyle}>
          {t('library.premiumTitle')}
        </Text>
        <Text className="mt-0.5 text-xs text-brand-100" style={bodyTextStyle}>
          {t('library.premiumHint')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ffffff" />
    </Pressable>
  )
}

export default function LibraryScreen() {
  const { t } = useI18n()
  const { books, articles } = useLibrary()
  const { entitlement } = useAuth()
  const { headerTextStyle } = useTypography()

  const empty = books.length === 0 && articles.length === 0

  return (
    <Screen>
      <View className="px-4 pt-2">
        <Text className="text-2xl text-surface-900 dark:text-surface-50 pt-5" style={headerTextStyle}>
          {t('nav.library')}
        </Text>
      </View>

      {!entitlement?.active ? <PremiumPrompt /> : null}

      {empty ? (
        <EmptyState icon="🔖" title={t('library.empty')} subtitle={t('library.emptyHint')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {books.length > 0 ? (
            <View className="flex-row flex-wrap px-2 pt-4">
              {books.map((book) => (
                <View key={String(book.id)} className="w-1/3 p-2">
                  <BookCard book={book} variant="grid" />
                </View>
              ))}
            </View>
          ) : null}
          {articles.length > 0 ? (
            <View className="px-4 pt-2">
              {articles.map((article) => (
                <ArticleCard key={String(article.id)} article={article} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  )
}
