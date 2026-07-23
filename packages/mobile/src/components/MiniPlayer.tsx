import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAudio } from '@/context/AudioContext'
import { useTypography } from '@/context/TypographyContext'

/** Global mini audio player shown above the tab bar while a track is loaded. */
export function MiniPlayer() {
  const { current, isPlaying, isLoading, positionMillis, durationMillis, toggle, stop } = useAudio()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  if (!current) return null

  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0

  return (
    <View className="border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
      <View className="h-0.5 w-full bg-surface-200 dark:bg-surface-700">
        <View className="h-full bg-brand-500" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </View>
      <View className="flex-row items-center px-3 py-2">
        <View className="h-10 w-10 overflow-hidden rounded-md bg-surface-200 dark:bg-surface-700">
          {current.cover ? (
            <Image source={{ uri: current.cover }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text>🎵</Text>
            </View>
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text
            numberOfLines={1}
            className="text-sm text-surface-900 dark:text-surface-50"
            style={headerTextStyle}
          >
            {current.title}
          </Text>
          {current.artist ? (
            <Text numberOfLines={1} className="text-xs text-surface-400" style={bodyTextStyle}>
              {current.artist}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={toggle} hitSlop={8} className="mr-1 p-1">
          {isLoading ? (
            <ActivityIndicator color="#2563eb" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#2563eb" />
          )}
        </Pressable>
        <Pressable onPress={stop} hitSlop={8} className="p-1">
          <Ionicons name="close" size={22} color="#94a3b8" />
        </Pressable>
      </View>
    </View>
  )
}
