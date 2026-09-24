import { memo, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useReducedMotion } from 'react-native-reanimated'
import type { Author } from '@loikmon/api'
import { useTypography } from '@/context/TypographyContext'
import { pickImage } from '@/lib/url'
import { elevation } from '@/theme/colors'
import { CARD_MAX_FONT_SCALE } from './BookCard'

const CARD_SPACING = { marginBottom: 12 } as const
const AVATAR_SIZE = 56

export const AuthorCard = memo(function AuthorCard({ author }: { author: Author }) {
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const reduceMotion = useReducedMotion()
  const avatar = pickImage(author, AVATAR_SIZE)
  const id = author.id

  const onPress = useCallback(() => router.push(`/author/${id}`), [id])

  return (
    <Pressable
      onPress={onPress}
      style={CARD_SPACING}
      className="active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={String(author.name)}
    >
      <View className="flex-row items-center rounded-card bg-white p-3 dark:bg-surface-800" style={elevation.card}>
        <View className="h-14 w-14 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
          {avatar ? (
            <Image
              source={avatar}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={String(id)}
              transition={reduceMotion ? 0 : 150}
              accessible={false}
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-xl">👤</Text>
            </View>
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
            className="text-sm text-surface-900 dark:text-surface-50"
            style={headerTextStyle}
          >
            {author.name}
          </Text>
          {author.bio ? (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
              className="text-xs text-surface-500 dark:text-surface-400"
              style={bodyTextStyle}
            >
              {author.bio}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
})
