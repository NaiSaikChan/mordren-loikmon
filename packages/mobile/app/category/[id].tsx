import { ScrollView, Text, View, RefreshControl, Pressable, useWindowDimensions, type NativeScrollEvent } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useCategoryContent } from '@/hooks/useCategoryContent'
import { getCategoryIcon } from '@/lib/categoryIcons'
import { firstParam } from '@/lib/normalize'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useTheme } from '@/context/ThemeContext'

const CARD_MIN_WIDTH = 150

function isNearBottom({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent): boolean {
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - 400
}

export default function CategoryDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = firstParam(params.id)
  const { t } = useI18n()
  const { headerTextStyle } = useTypography()
  const { isDark } = useTheme()
  const { width } = useWindowDimensions()

  const { category, books, articles, booksTotal, articlesTotal, hasMore, loading, loadingMore, error, refresh, loadMore } =
    useCategoryContent(id)

  const icon = getCategoryIcon(id ?? '')
  const columns = Math.max(2, Math.floor(width / CARD_MIN_WIDTH))
  const cardWidth = (width - 32) / columns // 32 = 16px padding each side
  const isEmpty = !loading && books.length === 0 && articles.length === 0

  return (
    <Screen>
      {/* Back button */}
      <View className="px-4 pt-2 pb-1">
        <Pressable onPress={() => router.back()} hitSlop={12} className="flex-row items-center gap-1 self-start">
          <Ionicons name="chevron-back" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
          <Text className="text-sm text-surface-500 dark:text-surface-400" style={headerTextStyle}>
            {t('nav.categories')}
          </Text>
        </Pressable>
      </View>

      {/* Category header */}
      <View className="flex-row items-center gap-3 px-4 pb-4 pt-1">
        <View className="w-14 h-14 rounded-xl bg-brand-50 dark:bg-brand-900/30 items-center justify-center shrink-0">
          <Text style={[headerTextStyle, { fontSize: 30 }]}>{icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-2xl text-surface-900 dark:text-surface-50" style={headerTextStyle}>
            {category?.name ?? '…'}
          </Text>
          {booksTotal > 0 || articlesTotal > 0 ? (
            <Text className="text-sm text-surface-400 mt-0.5" style={headerTextStyle}>
              {booksTotal > 0 ? `${booksTotal} ${t('books.title')}` : ''}
              {booksTotal > 0 && articlesTotal > 0 ? ' · ' : ''}
              {articlesTotal > 0 ? `${articlesTotal} ${t('articles.title')}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {loading && books.length === 0 && articles.length === 0 ? (
        <LoadingSpinner />
      ) : error && isEmpty ? (
        <EmptyState icon="⚠️" title={t('common.error')} subtitle={error} />
      ) : isEmpty ? (
        <EmptyState icon="📚" title={t('common.notFound')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
          onScroll={({ nativeEvent }) => {
            if (hasMore && isNearBottom(nativeEvent)) void loadMore()
          }}
          scrollEventThrottle={400}
        >
          {books.length > 0 ? (
            <View className="mb-6">
              <Text className="text-base text-surface-900 dark:text-surface-50 mb-3" style={headerTextStyle}>
                {t('books.title')}
                <Text className="text-sm font-normal text-surface-400" style={headerTextStyle}>  {booksTotal}</Text>
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

          {articles.length > 0 ? (
            <View className={books.length > 0 ? 'pt-2 border-t border-surface-100 dark:border-surface-800' : ''}>
              <Text className="text-base text-surface-900 dark:text-surface-50 mb-3 mt-4" style={headerTextStyle}>
                {t('articles.title')}
                <Text className="text-sm font-normal text-surface-400" style={headerTextStyle}>  {articlesTotal}</Text>
              </Text>
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </View>
          ) : null}

          {hasMore ? (
            <View className="mt-4">
              <PrimaryButton label={t('common.more')} variant="ghost" loading={loadingMore} onPress={() => void loadMore()} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  )
}
