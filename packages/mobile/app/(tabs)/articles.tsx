import { FlatList, RefreshControl } from 'react-native'
import { Screen } from '@/components/Screen'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useArticles } from '@/hooks/useArticles'
import { useI18n } from '@/context/I18nContext'

export default function ArticlesScreen() {
  const { t } = useI18n()
  const { items, loading, refreshing, refresh, loadMore } = useArticles()

  if (loading && items.length === 0) {
    return (
      <Screen>
        <LoadingSpinner />
      </Screen>
    )
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ArticleCard article={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={<EmptyState icon="📰" title={t('articles.noArticles')} />}
      />
    </Screen>
  )
}
