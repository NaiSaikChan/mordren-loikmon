import { Screen } from '@/components/Screen'
import { BookGrid } from '@/components/BookGrid'
import { useBooks } from '@/hooks/useBooks'
import { useI18n } from '@/context/I18nContext'

export default function BooksScreen() {
  const { t } = useI18n()
  const { items, loading, refreshing, refresh, loadMore } = useBooks()

  return (
    <Screen>
      <BookGrid
        books={items}
        loading={loading}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        emptyTitle={t('books.noBooks')}
      />
    </Screen>
  )
}
