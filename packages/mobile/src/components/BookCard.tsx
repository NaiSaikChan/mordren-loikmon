import { View, Text, Image, Pressable } from 'react-native'
import { Link } from 'expo-router'
import type { Book } from '@loikmon/api'
import { useTypography } from '@/context/TypographyContext'
import { pickCover } from '@/lib/url'
import { PriceBadge } from './PriceBadge'

/** Poster-style book card used across home, books, search and library. */
export function BookCard({
  book,
  width = 132,
  variant = 'carousel',
}: {
  book: Book
  width?: number
  variant?: 'carousel' | 'grid'
}) {
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const cover = pickCover(book as unknown as Record<string, unknown>)
  const author = (book.authorname as string) ?? (book.author as string) ?? ''
  const isGrid = variant === 'grid'
  return (
    <Link href={`/book/${book.id}`} asChild>
      <Pressable
        style={isGrid ? undefined : { width }}
        className={isGrid ? 'flex-1' : 'mr-3'}
      >
        <View className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface-200 dark:bg-surface-800">
          {cover ? (
            <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-4xl">📚</Text>
            </View>
          )}
        </View>
        <Text
          numberOfLines={2}
          className="mt-2 text-sm text-surface-900 dark:text-surface-50 pt-1"
          style={headerTextStyle}
        >
          {book.title}
        </Text>
        {author ? (
          <Text numberOfLines={1} className="text-xs text-surface-400 pt-3" style={bodyTextStyle}>
            {author}
          </Text>
        ) : null}
        <View className="mt-1 py-2 pt-2">
          <PriceBadge item={book as unknown as Record<string, unknown>} />
        </View>
      </Pressable>
    </Link>
  )
}
