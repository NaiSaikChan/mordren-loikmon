import { FlatList, RefreshControl, View } from 'react-native'
import type { Book } from '@loikmon/api'
import { BookCard } from './BookCard'
import { LoadingSpinner } from './LoadingSpinner'
import { EmptyState } from './EmptyState'
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns'

/** Responsive, refreshable, paginated grid of books. */
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

  if (loading && books.length === 0) return <LoadingSpinner />

  return (
    <FlatList
      key={`cols-${columns}`}
      data={books}
      numColumns={columns}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View className="flex-1 p-2">
          <BookCard book={item} variant="grid" />
        </View>
      )}
      columnWrapperStyle={{ paddingHorizontal: 8 }}
      contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={!loading ? <EmptyState icon="📚" title={emptyTitle} /> : null}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
        ) : undefined
      }
    />
  )
}
