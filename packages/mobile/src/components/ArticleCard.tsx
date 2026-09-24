import { memo, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useReducedMotion } from 'react-native-reanimated'
import type { Article } from '@loikmon/api'
import { useTypography } from '@/context/TypographyContext'
import { pickImage } from '@/lib/url'
import { elevation } from '@/theme/colors'
import { CARD_MAX_FONT_SCALE, useAccessLabel } from './BookCard'
import { PriceBadge } from './PriceBadge'

const CARD_SPACING = { marginBottom: 12 } as const
const THUMB_SIZE = 80

/** Horizontal list-row card for an article. */
export const ArticleCard = memo(function ArticleCard({ article }: { article: Article }) {
  const { headerTextStyle } = useTypography()
  const reduceMotion = useReducedMotion()
  const accessLabel = useAccessLabel(article)
  const thumb = pickImage(article, THUMB_SIZE)
  const category = article.categoryname ?? ''
  const id = article.id

  const onPress = useCallback(
    () => router.push({ pathname: '/articles/[id]', params: { id: String(id) } }),
    [id],
  )

  return (
    <Pressable
      onPress={onPress}
      style={CARD_SPACING}
      className="active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={[article.title, article.authorname, category, accessLabel].filter(Boolean).join(', ')}
    >
      <View className="flex-row rounded-card bg-white p-3 dark:bg-surface-800" style={elevation.card}>
        <View className="h-20 w-20 overflow-hidden rounded-control bg-surface-200 dark:bg-surface-700">
          {thumb ? (
            <Image
              source={thumb}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={String(id)}
              transition={reduceMotion ? 0 : 150}
              accessible={false}
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-2xl">📰</Text>
            </View>
          )}
        </View>
        <View className="ml-3 flex-1 justify-center">
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
            className="text-sm text-surface-900 dark:text-surface-50"
            style={headerTextStyle}
          >
            {article.title}
          </Text>

          {category ? (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
              className="text-2xs font-medium uppercase text-brand-600 dark:text-brand-400"
              style={headerTextStyle}
            >
              {category}
            </Text>
          ) : null}

          <View className="mt-1">
            <PriceBadge item={article} />
          </View>
        </View>
      </View>
    </Pressable>
  )
})
