import { useState } from 'react'
import { View, Text, ScrollView, FlatList } from 'react-native'
import { Screen } from '@/components/Screen'
import { SearchBar } from '@/components/SearchBar'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useSearch } from '@/hooks/useSearch'
import { useI18n } from '@/context/I18nContext'

export default function SearchScreen() {
  const { t } = useI18n()
  const { books, articles, loading, searched, run } = useSearch()
  const [text, setText] = useState('')

  const hasResults = books.length > 0 || articles.length > 0

  return (
    <Screen>
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
              <Text className="px-4 pt-4 pb-2 text-base font-bold text-surface-900 dark:text-surface-50">
                {t('nav.books')}
              </Text>
              <FlatList
                horizontal
                data={books}
                keyExtractor={(item) => `b-${item.id}`}
                renderItem={({ item }) => <BookCard book={item} />}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
              />
            </>
          ) : null}

          {articles.length > 0 ? (
            <>
              <Text className="px-4 pt-4 pb-2 text-base font-bold text-surface-900 dark:text-surface-50">
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
