import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAudio } from '@/context/AudioContext'
import { useTypography } from '@/context/TypographyContext'

/** Global mini audio player shown above the tab bar while a track is loaded. */
export function MiniPlayer() {
  const { current, queue, isPlaying, isLoading, positionMillis, durationMillis, toggle, stop, next, previous } = useAudio()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  if (!current) return null

  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0
  const hasQueue = queue.length > 1

  const openPlayer = () => {
    const targetId = current.sourceBookId ?? current.id
    if (targetId === undefined || targetId === null) return
    router.push({ pathname: '/audiobook/[id]', params: { id: String(targetId) } })
  }

  return (
    <Pressable
      onPress={openPlayer}
      className="mx-2 mb-2 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-800"
      accessibilityRole="button"
      accessibilityLabel="Open audiobook player"
    >
      <View className="h-1 w-full bg-surface-200 dark:bg-surface-700">
        <View className="h-full bg-brand-500" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </View>

      <View className="flex-row items-center px-3 py-2.5">
        <View className="h-11 w-11 overflow-hidden rounded-lg bg-surface-200 dark:bg-surface-700">
          {current.cover ? (
            <Image source={{ uri: current.cover }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text>🎧</Text>
            </View>
          )}
        </View>

        <View className="ml-3 flex-1 pr-2">
          <Text
            numberOfLines={1}
            className="text-sm text-surface-900 dark:text-surface-50"
            style={headerTextStyle}
          >
            {current.chapterTitle || current.title}
          </Text>
          <Text numberOfLines={1} className="text-xs text-brand-500" style={bodyTextStyle}>
            {current.artist || 'Audiobook'}
          </Text>
        </View>

        {hasQueue ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation()
              void previous()
            }}
            hitSlop={8}
            className="mr-1 rounded-full p-1.5"
          >
            <Ionicons name="play-skip-back" size={18} color="#64748b" />
          </Pressable>
        ) : null}

        <Pressable
          onPress={(event) => {
            event.stopPropagation()
            void toggle()
          }}
          hitSlop={8}
          className="mr-1 rounded-full bg-brand-50 p-2 dark:bg-brand-900/30"
        >
          {isLoading ? (
            <ActivityIndicator color="#2563eb" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#2563eb" />
          )}
        </Pressable>

        {hasQueue ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation()
              void next()
            }}
            hitSlop={8}
            className="mr-1 rounded-full p-1.5"
          >
            <Ionicons name="play-skip-forward" size={18} color="#64748b" />
          </Pressable>
        ) : null}

        <Pressable
          onPress={(event) => {
            event.stopPropagation()
            void stop()
          }}
          hitSlop={8}
          className="rounded-full p-1"
        >
          <Ionicons name="close" size={19} color="#94a3b8" />
        </Pressable>
      </View>
    </Pressable>
  )
}
