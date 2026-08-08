import { useEffect, useState } from 'react'
import { View, Text, ScrollView, FlatList } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Screen } from '@/components/Screen'
import { SearchBar } from '@/components/SearchBar'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useSearch } from '@/hooks/useSearch'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
export default function SearchScreen() {
  const { t } = useI18n()
  const { books, articles, loading, searched, run } = useSearch()
  const { q } = useLocalSearchParams<{ q?: string }>()
  const [text, setText] = useState(q ?? '')
  const { headerTextStyle, bodyTextStyle } = useTypography()

  // Auto-run search when navigated from home bar
  useEffect(() => {
    if (q?.trim()) { setText(q); run(q) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasResults = books.length > 0 || articles.length > 0

  return (
    <Screen>
      <View className="px-4 pt-2">
        <Text className="text-2xl font-bold text-surface-900 dark:text-surface-50 pt-2" style={headerTextStyle}>
          {t('nav.search')}
        </Text>
      </View>
      <View className="px-4 pt-2">
        <SearchBar
          value={text}
          onChangeText={setText}
          onSubmit={() => run(text)}
          placeholder={t('search.placeholder')}
        />
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : searched && !hasResults ? (
        <EmptyState icon="🔍" title={t('search.noResults')} />
      ) : !searched ? (
        <EmptyState icon="🔍" title={t('search.placeholder')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {books.length > 0 ? (
            <>
              <Text className="px-4 pt-4 pb-2 text-base font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                {t('nav.books')}
              </Text>
              <FlatList
                horizontal
                data={books}
                keyExtractor={(item) => `b-${item.id}`}
                renderItem={({ item }) => <BookCard book={item} />}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 16, paddingRight: 4, alignItems: 'flex-start' }}
              />
            </>
          ) : null}

          {articles.length > 0 ? (
            <>
              <Text className="px-4 pt-4 pb-2 text-base font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                {t('nav.articles')}
              </Text>
              <View className="px-4">
                {articles.map((article) => (
                  <ArticleCard key={`a-${article.id}`} article={article} />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  )
}
