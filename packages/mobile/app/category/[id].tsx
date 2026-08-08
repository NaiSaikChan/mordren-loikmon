import { ScrollView, Text, View, RefreshControl, useWindowDimensions } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Pressable } from 'react-native'
import { Screen } from '@/components/Screen'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useCategoryContent } from '@/hooks/useCategoryContent'
import { useCategories } from '@/hooks/useCategories'
import { getCategoryIcon } from '@/lib/categoryIcons'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useTheme } from '@/context/ThemeContext'

const CARD_MIN_WIDTH = 150

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useI18n()
  const { headerTextStyle } = useTypography()
  const { isDark } = useTheme()
  const { width } = useWindowDimensions()

  const { items: categories } = useCategories()
  const { books, articles, loading, refresh } = useCategoryContent(id ?? '')

  const cat = categories.find((c) => String(c.id) === String(id))
  const catName = cat?.name ?? '…'
  const icon = getCategoryIcon(id ?? '')

  const columns = Math.max(2, Math.floor(width / CARD_MIN_WIDTH))
  const cardWidth = (width - 32) / columns  // 32 = 16px padding each side

  const isEmpty = !loading && books.length === 0 && articles.length === 0

  return (
    <Screen>
      {/* Back button */}
      <View className="px-4 pt-2 pb-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="flex-row items-center gap-1 self-start"
        >
          <Ionicons name="chevron-back" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
          <Text className="text-sm text-surface-500 dark:text-surface-400" style={headerTextStyle}>
            {t('nav.categories')}
          </Text>
        </Pressable>
      </View>

      {/* Category header */}
      <View className="flex-row items-center gap-3 px-4 pb-4 pt-1">
        <View className="w-14 h-14 rounded-xl bg-brand-50 dark:bg-brand-900/30 items-center justify-center shrink-0">
          <Text style={{ fontSize: 30 }}>{icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-2xl text-surface-900 dark:text-surface-50" style={headerTextStyle}>
            {catName}
          </Text>
          {!loading && (books.length > 0 || articles.length > 0) ? (
            <Text className="text-sm text-surface-400 mt-0.5" style={headerTextStyle}>
              {books.length > 0 ? `${books.length} ${t('books.title')}` : ''}
              {books.length > 0 && articles.length > 0 ? ' · ' : ''}
              {articles.length > 0 ? `${articles.length} ${t('articles.title')}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {loading && books.length === 0 && articles.length === 0 ? (
        <LoadingSpinner />
      ) : isEmpty ? (
        <EmptyState icon="📚" title={t('common.notFound')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        >
          {/* ── Books section ── */}
          {books.length > 0 ? (
            <View className="mb-6">
              <Text
                className="text-base font-bold text-surface-900 dark:text-surface-50 mb-3"
                style={headerTextStyle}
              >
                {t('books.title')}
                <Text className="text-sm font-normal text-surface-400">  {books.length}</Text>
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                {books.map((book) => (
                  <View key={book.id} style={{ width: cardWidth, padding: 4 }}>
                    <BookCard book={book} variant="grid" />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── Articles section ── */}
          {articles.length > 0 ? (
            <View className={books.length > 0 ? 'pt-2 border-t border-surface-100 dark:border-surface-800' : ''}>
              <Text
                className="text-base font-bold text-surface-900 dark:text-surface-50 mb-3 mt-4"
                style={headerTextStyle}
              >
                {t('articles.title')}
                <Text className="text-sm font-normal text-surface-400">  {articles.length}</Text>
              </Text>
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  )
}
