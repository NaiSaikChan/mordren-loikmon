import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  Platform,
  SectionList,
  Text,
  View,
  type ListRenderItem,
  type SectionListData,
  type SectionListRenderItem,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import type { Article, Author, Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { SearchBar } from '@/components/SearchBar'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { AuthorCard } from '@/components/AuthorCard'
import { ListSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { useSearch } from '@/hooks/useSearch'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'

type Row =
  | { kind: 'books'; key: string; books: Book[] }
  | { kind: 'article'; key: string; article: Article }
  | { kind: 'author'; key: string; author: Author }
type Section = { key: string; title: string; data: Row[] }

const rowKey = (row: Row) => row.key
const bookKey = (item: Book) => `b-${item.id}`
const renderBook: ListRenderItem<Book> = ({ item }) => <BookCard book={item} />
const CAROUSEL_CONTENT = { paddingLeft: 16, paddingRight: 4, alignItems: 'flex-start' } as const
const CONTENT = { paddingBottom: 24 } as const

const renderRow: SectionListRenderItem<Row, Section> = ({ item }) => {
  switch (item.kind) {
    case 'books':
      return (
        <FlatList
          horizontal
          data={item.books}
          keyExtractor={bookKey}
          renderItem={renderBook}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={CAROUSEL_CONTENT}
          initialNumToRender={4}
          windowSize={5}
        />
      )
    case 'article':
      return (
        <View className="px-4">
          <ArticleCard article={item.article} />
        </View>
      )
    case 'author':
      return (
        <View className="px-4">
          <AuthorCard author={item.author} />
        </View>
      )
  }
}

export default function SearchScreen() {
  const { t } = useI18n()
  const { books, articles, authors, loading, searched, run } = useSearch()
  const { q } = useLocalSearchParams<{ q?: string }>()
  const [text, setText] = useState(q ?? '')
  const { headerTextStyle } = useTypography()

  // Auto-run search when navigated from home bar (`text` is initialised from `q`).
  useEffect(() => {
    if (q?.trim()) run(q)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = useCallback(() => run(text), [run, text])

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = []
    if (books.length > 0) {
      out.push({ key: 'books', title: t('nav.books'), data: [{ kind: 'books', key: 'books', books }] })
    }
    if (articles.length > 0) {
      out.push({
        key: 'articles',
        title: t('nav.articles'),
        data: articles.map((article) => ({ kind: 'article', key: `a-${article.id}`, article })),
      })
    }
    if (authors.length > 0) {
      out.push({
        key: 'authors',
        title: t('nav.authors'),
        data: authors.map((author) => ({ kind: 'author', key: `u-${author.id}`, author })),
      })
    }
    return out
  }, [books, articles, authors, t])

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Row, Section> }) => (
      <Text
        className="px-4 pb-2 pt-4 text-base text-surface-900 dark:text-surface-50"
        style={headerTextStyle}
        accessibilityRole="header"
      >
        {section.title}
      </Text>
    ),
    [headerTextStyle],
  )

  return (
    <Screen>
      <View className="px-4 pt-3">
        <Text
          className="text-2xl text-surface-900 dark:text-surface-50"
          style={headerTextStyle}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.6}
        >
          {t('nav.search')}
        </Text>
      </View>
      <View className="px-4 pt-2">
        <SearchBar value={text} onChangeText={setText} onSubmit={onSubmit} placeholder={t('search.placeholder')} />
      </View>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : !searched ? (
        <EmptyState icon="🔍" title={t('search.placeholder')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={rowKey}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={CONTENT}
          ListEmptyComponent={<EmptyState icon="🔍" title={t('search.noResults', { query: text.trim() })} />}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </Screen>
  )
}
