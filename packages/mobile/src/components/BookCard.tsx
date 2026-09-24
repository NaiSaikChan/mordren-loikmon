import { memo, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useReducedMotion } from 'react-native-reanimated'
import type { Book } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { accessBadge } from '@/lib/access'
import { pickImage } from '@/lib/url'
import { radius } from '@/theme/colors'
import { PriceBadge } from './PriceBadge'

/** Poster aspect ratio (width / height) shared by every book cover. */
export const BOOK_COVER_ASPECT_RATIO = 3 / 4

/** Dense card text may grow with Dynamic Type, but only this far. */
export const CARD_MAX_FONT_SCALE = 1.4

/**
 * Text metrics sized for stacked Myanmar/Mon diacritics (~1.6–1.7× leading).
 * Each line reserves its height (scaled with the user's font size) so grid
 * rows stay aligned regardless of how many lines a title wraps to.
 */
const TITLE_FONT_SIZE = 13
const TITLE_LINE_HEIGHT = 22
const TITLE_LINES = 2
const AUTHOR_FONT_SIZE = 12
const AUTHOR_LINE_HEIGHT = 20
const CATEGORY_FONT_SIZE = 11
const CATEGORY_LINE_HEIGHT = 18

/** Price/access phrase for a combined screen-reader label. */
export function useAccessLabel(item: { is_free?: boolean }): string {
  const { t } = useI18n()
  const { entitlement } = useAuth()
  const kind = accessBadge(item, entitlement)
  if (kind === 'free') return t('books.free')
  if (kind === 'premium-locked') return `${t('books.premium')}, ${t('a11y.locked')}`
  return t('books.premium')
}

/** Poster-style book card used across home, books, search and library. */
export const BookCard = memo(function BookCard({
  book,
  width = 132,
  variant = 'carousel',
  imageWidth,
  testID = 'book-card',
}: {
  book: Book
  width?: number
  variant?: 'carousel' | 'grid'
  /** Rendered cover width in points (grid cells); picks the image variant. */
  imageWidth?: number
  testID?: string
}) {
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const reduceMotion = useReducedMotion()
  const accessLabel = useAccessLabel(book)
  const isGrid = variant === 'grid'
  const cover = pickImage(book, imageWidth ?? (isGrid ? 160 : width))
  const author = book.authorname ?? ''
  const category = book.categoryname ?? ''
  const id = book.id

  const onPress = useCallback(() => router.push(`/book/${id}`), [id])

  return (
    <View style={isGrid ? styles.gridCard : [styles.carouselCard, { width }]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        className="active:opacity-80"
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={[book.title, author, accessLabel].filter(Boolean).join(', ')}
      >
        <View style={styles.cover} className="w-full overflow-hidden bg-surface-200 dark:bg-surface-800">
          {cover ? (
            <Image
              source={cover}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={String(id)}
              transition={reduceMotion ? 0 : 150}
              accessible={false}
            />
          ) : (
            <View style={styles.coverFallback}>
              <Text style={styles.coverFallbackIcon}>📚</Text>
            </View>
          )}
        </View>

        <View style={styles.titleBlock}>
          <Text
            numberOfLines={TITLE_LINES}
            maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
            className="text-surface-900 dark:text-surface-50"
            style={[headerTextStyle, styles.title]}
          >
            {book.title}
          </Text>
          {category ? (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
              className="text-brand-600 dark:text-brand-400"
              style={[{ fontFamily: headerTextStyle?.fontFamily }, styles.category]}
            >
              {category}
            </Text>
          ) : null}
          {author ? (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
              className="text-surface-500 dark:text-surface-400"
              style={[bodyTextStyle, styles.author]}
            >
              {author}
            </Text>
          ) : null}
        </View>

        <View style={styles.badgeRow}>
          <PriceBadge item={book} />
        </View>
      </Pressable>
    </View>
  )
})

const styles = StyleSheet.create({
  // Cards stretch to the tallest card in their row; the badge is pushed to the
  // bottom so badges line up even when titles wrap to different line counts.
  gridCard: { width: '100%', flex: 1 },
  carouselCard: { marginRight: 12 },
  pressable: { flex: 1 },
  cover: {
    width: '100%',
    aspectRatio: BOOK_COVER_ASPECT_RATIO,
    borderRadius: radius.control,
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
  titleBlock: { marginTop: 8 },
  title: {
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_LINE_HEIGHT,
    letterSpacing: -0.2,
  },
  category: {
    marginTop: 2,
    fontSize: CATEGORY_FONT_SIZE,
    lineHeight: CATEGORY_LINE_HEIGHT,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  author: {
    fontSize: AUTHOR_FONT_SIZE,
    lineHeight: AUTHOR_LINE_HEIGHT,
    letterSpacing: -0.1,
  },
  badgeRow: {
    marginTop: 'auto',
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
