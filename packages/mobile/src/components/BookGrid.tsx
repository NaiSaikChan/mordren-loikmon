import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'
import { useMemo } from 'react'
import type { Book } from '@loikmon/api'
import { BookCard } from './BookCard'
import { LoadingSpinner } from './LoadingSpinner'
import { EmptyState } from './EmptyState'
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns'

const GUTTER = 12
const EDGE = 16

type GridItem = { book: Book } | { book: null; key: string }

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

  // Pad the final row with invisible placeholders so cards keep their real
  // width instead of stretching across the leftover space.
  const data = useMemo<GridItem[]>(() => {
    const items: GridItem[] = books.map((book) => ({ book }))
    const remainder = items.length % columns
    if (items.length > 0 && remainder !== 0) {
      for (let i = remainder; i < columns; i += 1) {
        items.push({ book: null, key: `placeholder-${i}` })
      }
    }
    return items
  }, [books, columns])

  if (loading && books.length === 0) return <LoadingSpinner />

  const isPagingIn = Boolean(loading) && books.length > 0

  return (
    <FlatList
      key={`cols-${columns}`}
      data={data}
      numColumns={columns}
      keyExtractor={(item) => (item.book ? `book-${item.book.id}` : item.key)}
      renderItem={({ item }) => (
        <View style={{ flex: 1 }}>
          {item.book ? <BookCard book={item.book} variant="grid" /> : null}
        </View>
      )}
      columnWrapperStyle={columns > 1 ? { gap: GUTTER } : undefined}
      contentContainerStyle={{
        paddingHorizontal: EDGE,
        paddingTop: 8,
        paddingBottom: 32,
        gap: 20,
        flexGrow: books.length === 0 ? 1 : undefined,
      }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={!loading ? <EmptyState icon="📚" title={emptyTitle} /> : null}
      ListFooterComponent={
        isPagingIn ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : null
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      initialNumToRender={columns * 4}
      windowSize={7}
      removeClippedSubviews
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
        ) : undefined
      }
    />
  )
}
