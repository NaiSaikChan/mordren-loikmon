import { useCallback } from 'react'
import { FlatList, Platform, RefreshControl, View, useWindowDimensions, type ListRenderItem } from 'react-native'
import type { Book } from '@loikmon/api'
import { useThemeColors } from '@/theme/colors'
import { BookCard } from './BookCard'
import { BookGridSkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns'

const keyExtractor = (item: Book) => String(item.id)
const COLUMN_WRAPPER = { paddingHorizontal: 8 } as const
const CONTENT = { paddingVertical: 8, paddingBottom: 24 } as const

/**
 * Responsive, refreshable, paginated grid of books.
 *
 * No `getItemLayout`: card height follows the user's font scale and the
 * PriceBadge, so rows are measured rather than assumed.
 */
export function BookGrid({
  books,
  loading,
  refreshing,
  onRefresh,
  onEndReached,
  emptyTitle,
  ListHeaderComponent,
}: {
  books: Book[]
  loading?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  onEndReached?: () => void
  emptyTitle: string
  ListHeaderComponent?: React.ReactElement
}) {
  const columns = useResponsiveColumns()
  const { width } = useWindowDimensions()
  const colors = useThemeColors()
  const cellWidth = Math.round((width - 16) / columns - 16)

  const renderItem = useCallback<ListRenderItem<Book>>(
    ({ item }) => (
      <View className="flex-1 p-2">
        <BookCard book={item} variant="grid" imageWidth={cellWidth} />
      </View>
    ),
    [cellWidth],
  )

  if (loading && books.length === 0) {
    return (
      <>
        {ListHeaderComponent}
        <BookGridSkeleton columns={columns} />
      </>
    )
  }

  return (
    <FlatList
      key={`cols-${columns}`}
      data={books}
      numColumns={columns}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      columnWrapperStyle={COLUMN_WRAPPER}
      contentContainerStyle={CONTENT}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={!loading ? <EmptyState icon="📚" title={emptyTitle} /> : null}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      initialNumToRender={columns * 3}
      maxToRenderPerBatch={columns * 3}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brandSolid]}
          />
        ) : undefined
      }
    />
  )
}
