import { useCallback } from 'react'
import { FlatList, Platform, RefreshControl, type ListRenderItem } from 'react-native'
import { Stack } from 'expo-router'
import type { Author } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { AuthorCard } from '@/components/AuthorCard'
import { ListSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { useAuthors } from '@/hooks/useAuthors'
import { useI18n } from '@/context/I18nContext'
import { useThemeColors } from '@/theme/colors'

const keyExtractor = (item: Author) => String(item.id)
const renderItem: ListRenderItem<Author> = ({ item }) => <AuthorCard author={item} />
const CONTENT = { padding: 16 } as const

export default function AuthorsScreen() {
  const { t } = useI18n()
  const colors = useThemeColors()
  const { items, loading, loadMore, refreshing, refresh } = useAuthors()
  const onEndReached = useCallback(() => void loadMore(), [loadMore])
  const onRefresh = useCallback(() => void refresh(), [refresh])

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('nav.authors') }} />
      {loading && items.length === 0 ? (
        <ListSkeleton thumbSize={56} round />
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={CONTENT}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brandSolid]} />
          }
          ListEmptyComponent={<EmptyState icon="👤" title={t('authors.noAuthors')} />}
        />
      )}
    </Screen>
  )
}
