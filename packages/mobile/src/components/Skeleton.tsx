import { memo, useEffect } from 'react'
import { View, useWindowDimensions, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useI18n } from '@/context/I18nContext'
import { radius as radii, useThemeColors } from '@/theme/colors'
import { BOOK_COVER_ASPECT_RATIO } from './BookCard'

/** Pulsing placeholder block; static when the OS asks for reduced motion. */
export const Skeleton = memo(function Skeleton({
  width = '100%',
  height,
  radius = radii.control,
  style,
}: {
  width?: DimensionValue
  height?: DimensionValue
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1
      return
    }
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true)
    return () => cancelAnimation(opacity)
  }, [reduceMotion, opacity])

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.placeholderFill }, animated, style]}
    />
  )
})

/** Accessible wrapper announcing a loading region once instead of each block. */
function SkeletonGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n()
  return (
    <View
      style={style}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('a11y.loading')}
      accessibilityState={{ busy: true }}
    >
      {children}
    </View>
  )
}

/** First-load placeholder for a grid of BookCards. */
export function BookGridSkeleton({ columns, rows = 3 }: { columns: number; rows?: number }) {
  const { width } = useWindowDimensions()
  const cellWidth = (width - 16) / columns - 16
  return (
    <SkeletonGroup style={{ paddingHorizontal: 8, paddingTop: 8 }}>
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {Array.from({ length: columns }).map((__, col) => (
            <View key={col} style={{ flex: 1, padding: 8 }}>
              <Skeleton height={cellWidth / BOOK_COVER_ASPECT_RATIO} radius={radii.control} />
              <Skeleton height={14} width="90%" style={{ marginTop: 10 }} />
              <Skeleton height={12} width="60%" style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      ))}
    </SkeletonGroup>
  )
}

/** First-load placeholder for thumbnail + text rows (articles, authors, categories). */
export function ListSkeleton({
  rows = 6,
  thumbSize = 80,
  round = false,
}: {
  rows?: number
  thumbSize?: number
  round?: boolean
}) {
  return (
    <SkeletonGroup style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Skeleton width={thumbSize} height={thumbSize} radius={round ? thumbSize / 2 : radii.control} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton height={14} width="85%" />
            <Skeleton height={12} width="50%" style={{ marginTop: 10 }} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  )
}
