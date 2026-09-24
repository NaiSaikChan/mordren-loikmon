import { useCallback } from 'react'
import { FlatList, Platform, RefreshControl, Text, View, type ListRenderItem } from 'react-native'
import type { Article } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { ArticleCard } from '@/components/ArticleCard'
import { ListSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { useArticles } from '@/hooks/useArticles'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

const keyExtractor = (item: Article) => String(item.id)
const renderItem: ListRenderItem<Article> = ({ item }) => <ArticleCard article={item} />
const CONTENT = { padding: 16, paddingBottom: 24 } as const

export default function ArticlesScreen() {
  const { t } = useI18n()
  const { items, loading, refreshing, refresh, loadMore } = useArticles()
  const { headerTextStyle } = useTypography()
  const colors = useThemeColors()
  const onRefresh = useCallback(() => void refresh(), [refresh])
  const onEndReached = useCallback(() => void loadMore(), [loadMore])

  return (
    <Screen>
      <View className="px-4 pt-3">
        <Text
          className="text-2xl text-surface-900 dark:text-surface-50"
          style={headerTextStyle}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.6}
        >
          {t('nav.articles')}
        </Text>
      </View>
      {loading && items.length === 0 ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={CONTENT}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brandSolid]} />
          }
          ListEmptyComponent={<EmptyState icon="📰" title={t('articles.noArticles')} />}
        />
      )}
    </Screen>
  )
}
