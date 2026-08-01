import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { Link } from 'expo-router'
import type { Book } from '@loikmon/api'
import { useTypography } from '@/context/TypographyContext'
import { pickCover } from '@/lib/url'
import { PriceBadge } from './PriceBadge'

/** Poster aspect ratio (width / height) shared by every book cover. */
export const BOOK_COVER_ASPECT_RATIO = 3 / 4

/**
 * Fixed text metrics keep every card the same height so grid rows stay aligned
 * regardless of how many lines a Myanmar/Mon title wraps to.
 */
const TITLE_FONT_SIZE = 13
const TITLE_LINE_HEIGHT = 21
const TITLE_LINES = 2
const AUTHOR_FONT_SIZE = 11.5
const AUTHOR_LINE_HEIGHT = 18
const CATEGORY_FONT_SIZE = 11
const CATEGORY_LINE_HEIGHT = 16

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
  const category = (book.categoryname as string) ?? (book.cat as string) ?? ''

  const isGrid = variant === 'grid'

  return (
    <View style={isGrid ? styles.gridCard : [styles.carouselCard, { width }]}>
      <Link href={`/book/${book.id}`} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={author ? `${book.title}, ${author}` : String(book.title)}
        >
          <View
            style={styles.cover}
            className="w-full overflow-hidden rounded-xl bg-surface-200 dark:bg-surface-800"
          >
            {cover ? (
              <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.coverFallback}>
                <Text style={styles.coverFallbackIcon}>📚</Text>
              </View>
            )}
          </View>

          <View style={styles.titleBlock}>
            <Text
              numberOfLines={TITLE_LINES}
              className="text-surface-900 dark:text-surface-50"
              style={[
                headerTextStyle,
                {
                  fontSize: TITLE_FONT_SIZE,
                  lineHeight: TITLE_LINE_HEIGHT,
                  letterSpacing: -0.2,
                },
              ]}
              allowFontScaling={false}
            >
              {book.title}
            </Text>
            <Text
              numberOfLines={1}
              className="text-brand-500"
              style={{
                fontFamily: headerTextStyle?.fontFamily,
                fontSize: CATEGORY_FONT_SIZE,
                lineHeight: CATEGORY_LINE_HEIGHT,
                minHeight: CATEGORY_LINE_HEIGHT,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              {category}
            </Text>
          </View>

          <Text
            numberOfLines={1}
            className="text-surface-500 dark:text-surface-400"
            style={[
              bodyTextStyle,
              {
                fontSize: AUTHOR_FONT_SIZE,
                lineHeight: AUTHOR_LINE_HEIGHT,
                minHeight: AUTHOR_LINE_HEIGHT,
                letterSpacing: -0.1,
              },
            ]}
            allowFontScaling={false}
          >
            {author}
          </Text>

          <View style={styles.badgeRow}>
            <PriceBadge item={book as unknown as Record<string, unknown>} />
          </View>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  gridCard: { width: '100%' },
  carouselCard: { marginRight: 12 },
  cover: {
    width: '100%',
    aspectRatio: BOOK_COVER_ASPECT_RATIO,
  },
  coverFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackIcon: { fontSize: 32 },
  titleBlock: {
    marginTop: 8,
    minHeight: TITLE_LINE_HEIGHT * TITLE_LINES + CATEGORY_LINE_HEIGHT,
    justifyContent: 'flex-start',
  },
  badgeRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
