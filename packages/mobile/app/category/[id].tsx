import { useCallback, useMemo } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
  useWindowDimensions,
  type SectionListData,
  type SectionListRenderItem,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useReducedMotion } from 'react-native-reanimated'
import type { Article, Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { ArticleCard } from '@/components/ArticleCard'
import { BookRow } from '@/components/BookRow'
import { BookGridSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { chunk } from '@/components/gridRows'
import { useCategoryContent } from '@/hooks/useCategoryContent'
import { getCategoryIcon } from '@/lib/categoryIcons'
import { pickImage } from '@/lib/url'
import { firstParam } from '@/lib/normalize'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

const CARD_MIN_WIDTH = 150
const THUMB_SIZE = 56
const CONTENT = { paddingBottom: 32, paddingHorizontal: 16 } as const

type Row = { kind: 'books'; key: string; books: Book[] } | { kind: 'article'; key: string; article: Article }
type Section = { key: string; title: string; total: number; data: Row[] }

const keyExtractor = (row: Row) => row.key
const goBack = () => router.back()

export default function CategoryDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = firstParam(params.id)
  const { t } = useI18n()
  const { headerTextStyle } = useTypography()
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const { width } = useWindowDimensions()

  const { category, books, articles, booksTotal, articlesTotal, hasMore, loading, loadingMore, error, refresh, loadMore } =
    useCategoryContent(id)

  const icon = getCategoryIcon(category?.id ?? id ?? '')
  const thumbnail = category ? pickImage(category, THUMB_SIZE) : ''
  const columns = Math.max(2, Math.floor(width / CARD_MIN_WIDTH))
  const imageWidth = Math.round((width - 32) / columns - 8)
  const isEmpty = !loading && books.length === 0 && articles.length === 0

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = []
    if (books.length > 0) {
      out.push({
        key: 'books',
        title: t('books.title'),
        total: booksTotal,
        data: chunk(books, columns).map((row) => ({ kind: 'books', key: `b-${row[0].id}`, books: row })),
      })
    }
    if (articles.length > 0) {
      out.push({
        key: 'articles',
        title: t('articles.title'),
        total: articlesTotal,
        data: articles.map((article) => ({ kind: 'article', key: `a-${article.id}`, article })),
      })
    }
    return out
  }, [books, articles, booksTotal, articlesTotal, columns, t])

  const renderItem = useCallback<SectionListRenderItem<Row, Section>>(
    ({ item }) =>
      item.kind === 'books' ? (
        <View className="mb-2">
          <BookRow books={item.books} columns={columns} imageWidth={imageWidth} />
        </View>
      ) : (
        <ArticleCard article={item.article} />
      ),
    [columns, imageWidth],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Row, Section> }) => (
      <View
        className={`mb-3 flex-row items-baseline gap-2 ${
          section.key === 'articles' && books.length > 0 ? 'mt-4 border-t border-surface-100 pt-4 dark:border-surface-800' : ''
        }`}
      >
        <Text className="text-base text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
          {section.title}
        </Text>
        <Text className="text-sm text-surface-500 dark:text-surface-400" style={headerTextStyle}>
          {section.total}
        </Text>
      </View>
    ),
    [headerTextStyle, books.length],
  )

  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore) void loadMore()
  }, [hasMore, loadingMore, loadMore])
  const onRefresh = useCallback(() => void refresh(), [refresh])

  const categoryHeader = (
    <View className="flex-row items-center gap-3 pb-4 pt-1">
      <View className="h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-control bg-brand-50 dark:bg-brand-900/30">
        {thumbnail ? (
          <Image
            source={thumbnail}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={reduceMotion ? 0 : 150}
            accessible={false}
          />
        ) : (
          <Text style={[headerTextStyle, { fontSize: 30, lineHeight: 40 }]}>{icon}</Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-2xl text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
          {category?.name ?? '…'}
        </Text>
        {booksTotal > 0 || articlesTotal > 0 ? (
          <Text className="text-sm text-surface-500 dark:text-surface-400" style={headerTextStyle}>
            {[
              booksTotal > 0 ? `${booksTotal} ${t('books.title')}` : '',
              articlesTotal > 0 ? `${articlesTotal} ${t('articles.title')}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>
    </View>
  )

  return (
    <Screen>
      {/* Native back button on pushed screens (book/article) shows this as its label. */}
      <Stack.Screen options={{ title: category?.name ?? t('nav.categories') }} />
      {/* Back button */}
      <View className="px-4 pt-1">
        <Pressable
          onPress={goBack}
          className="min-h-touch flex-row items-center gap-1 self-start pr-2 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <Ionicons name="chevron-back" size={20} color={colors.mutedText} />
          <Text className="text-sm text-surface-500 dark:text-surface-400" style={headerTextStyle}>
            {t('nav.categories')}
          </Text>
        </Pressable>
      </View>

      {loading && books.length === 0 && articles.length === 0 ? (
        <>
          <View className="px-4">{categoryHeader}</View>
          <BookGridSkeleton columns={columns} rows={2} />
        </>
      ) : error && isEmpty ? (
        <>
          <View className="px-4">{categoryHeader}</View>
          <EmptyState icon="⚠️" title={t('common.error')} subtitle={error} />
        </>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={categoryHeader}
          ListEmptyComponent={isEmpty ? <EmptyState icon="📚" title={t('common.notFound')} /> : null}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator className="py-4" color={colors.brand} accessibilityLabel={t('a11y.loading')} /> : null
          }
          contentContainerStyle={CONTENT}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={loading && !isEmpty}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brandSolid]}
            />
          }
        />
      )}
    </Screen>
  )
}
