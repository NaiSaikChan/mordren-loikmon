import { useCallback, useMemo } from 'react'
import {
  Platform,
  Pressable,
  SectionList,
  Text,
  View,
  useWindowDimensions,
  type SectionListData,
  type SectionListRenderItem,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Article, Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { ArticleCard } from '@/components/ArticleCard'
import { BookRow } from '@/components/BookRow'
import { EmptyState } from '@/components/EmptyState'
import { chunk } from '@/components/gridRows'
import { useLibrary } from '@/context/LibraryContext'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

const COLUMNS = 3
const CONTENT = { paddingHorizontal: 16, paddingBottom: 24 } as const

type Row = { kind: 'books'; key: string; books: Book[] } | { kind: 'article'; key: string; article: Article }
type Section = { key: string; title: string; data: Row[] }

const keyExtractor = (row: Row) => row.key
const goSubscribe = () => router.push('/subscribe')

function PremiumPrompt() {
  const { t } = useI18n()
  const { headerTextStyle, bodyTextStyle } = useTypography()
  const colors = useThemeColors()
  return (
    <Pressable
      onPress={goSubscribe}
      className="mt-3 flex-row items-center rounded-card bg-brand-600 p-4 active:opacity-90"
      accessibilityRole="button"
      accessibilityLabel={`${t('library.premiumTitle')}. ${t('library.premiumHint')}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-control bg-white/20">
        <Ionicons name="diamond-outline" size={20} color={colors.onBrand} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-base text-white" style={headerTextStyle}>
          {t('library.premiumTitle')}
        </Text>
        <Text className="mt-0.5 text-xs text-brand-100" style={bodyTextStyle}>
          {t('library.premiumHint')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.onBrand} />
    </Pressable>
  )
}

export default function LibraryScreen() {
  const { t } = useI18n()
  const { books, articles } = useLibrary()
  const { entitlement } = useAuth()
  const { headerTextStyle } = useTypography()
  const { width } = useWindowDimensions()
  const imageWidth = Math.round((width - 32) / COLUMNS - 8)

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = []
    if (books.length > 0) {
      out.push({
        key: 'books',
        title: t('nav.books'),
        data: chunk(books, COLUMNS).map((row) => ({ kind: 'books', key: `b-${row[0].id}`, books: row })),
      })
    }
    if (articles.length > 0) {
      out.push({
        key: 'articles',
        title: t('nav.articles'),
        data: articles.map((article) => ({ kind: 'article', key: `a-${article.id}`, article })),
      })
    }
    return out
  }, [books, articles, t])

  const renderItem = useCallback<SectionListRenderItem<Row, Section>>(
    ({ item }) =>
      item.kind === 'books' ? (
        <View className="mb-2">
          <BookRow books={item.books} columns={COLUMNS} imageWidth={imageWidth} />
        </View>
      ) : (
        <ArticleCard article={item.article} />
      ),
    [imageWidth],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Row, Section> }) => (
      <Text
        className="pb-2 pt-4 text-base text-surface-900 dark:text-surface-50"
        style={headerTextStyle}
        accessibilityRole="header"
      >
        {section.title}
      </Text>
    ),
    [headerTextStyle],
  )

  const header = (
    <View>
      <Text
        className="pt-3 text-2xl text-surface-900 dark:text-surface-50"
        style={headerTextStyle}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.6}
      >
        {t('nav.library')}
      </Text>
      {!entitlement?.active ? <PremiumPrompt /> : null}
    </View>
  )

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        // ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="🔖" title={t('library.empty')} subtitle={t('library.emptyHint')} />}
        contentContainerStyle={CONTENT}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </Screen>
  )
}
