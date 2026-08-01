import { Screen } from '@/components/Screen'
import { BookGrid } from '@/components/BookGrid'
import { useBooks } from '@/hooks/useBooks'
import { useI18n } from '@/context/I18nContext'
import { View, Text } from 'react-native'
import { useTypography } from '@/context/TypographyContext'

export default function BooksScreen() {
  const { t } = useI18n()
  const { items, loading, refreshing, refresh, loadMore } = useBooks()
  const { headerTextStyle } = useTypography()

  return (
    <Screen>
      <View className="px-4 pb-1 pt-2">
        <Text
          className="text-2xl font-bold text-surface-900 dark:text-surface-50 pt-2" style={headerTextStyle}
          allowFontScaling={false}
        >
          {t('nav.books')}
        </Text>
      </View>
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
