import { memo } from 'react'
import { View } from 'react-native'
import type { Book } from '@loikmon/api'
import { BookCard } from './BookCard'

/**
 * One row of a book grid rendered as a single list item, so grids can live in
 * a SectionList/FlatList next to other content. Short rows are padded with
 * empty cells to keep column widths equal.
 */
export const BookRow = memo(function BookRow({
  books,
  columns,
  imageWidth,
  gap = 8,
}: {
  books: Book[]
  columns: number
  imageWidth?: number
  gap?: number
}) {
  return (
    <View style={{ flexDirection: 'row', marginHorizontal: -gap / 2 }}>
      {Array.from({ length: columns }, (_, i) => {
        const book = books[i]
        return (
          <View key={book ? String(book.id) : `empty-${i}`} style={{ flex: 1, padding: gap / 2 }}>
            {book ? <BookCard book={book} variant="grid" imageWidth={imageWidth} /> : null}
          </View>
        )
      })}
    </View>
  )
})
