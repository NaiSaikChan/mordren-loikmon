import { FlatList, RefreshControl, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useArticles } from '@/hooks/useArticles'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'

export default function ArticlesScreen() {
  const { t } = useI18n()
  const { items, loading, refreshing, refresh, loadMore } = useArticles()
  const { headerTextStyle } = useTypography()

  if (loading && items.length === 0) {
    return (
      <Screen>
        <LoadingSpinner />
      </Screen>
    )
  }

  return (
    <Screen>
      <View className="px-4 pt-2">
        <Text className="text-2xl font-bold text-surface-900 dark:text-surface-50 pt-2" style={headerTextStyle}>
          {t('nav.articles')}
        </Text>
      </View>
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
