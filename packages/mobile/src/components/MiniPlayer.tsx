import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { SKIP_MILLIS, useAudio } from '@/context/AudioContext'
import { useI18n } from '@/context/I18nContext'
import { useTheme } from '@/context/ThemeContext'
import { useTypography } from '@/context/TypographyContext'

function formatTime(ms: number): string {
  if (!ms || ms < 0 || !isFinite(ms)) return '0:00'
  const total = Math.floor(ms / 1000)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const mm = hrs ? String(mins).padStart(2, '0') : String(mins)
  return `${hrs ? `${hrs}:` : ''}${mm}:${String(secs).padStart(2, '0')}`
}

/** Global mini audio player shown above the tab bar while a track is loaded. */
export function MiniPlayer() {
  const {
    current,
    queue,
    isPlaying,
    isLoading,
    positionMillis,
    durationMillis,
    toggle,
    stop,
    next,
    previous,
    skip,
  } = useAudio()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { isDark } = useTheme()
  const { t } = useI18n()
  if (!current) return null

  // Icon colours follow the theme; they used to be hard-coded light-mode hexes.
  const accent = isDark ? '#d4a843' : '#c9922a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0
  const hasQueue = queue.length > 1

  const openPlayer = () => {
    const targetId = current.sourceBookId
    if (targetId === undefined || targetId === null) return
    if (current.sourceType === 'article') {
      router.push({ pathname: '/articles/[id]', params: { id: String(targetId) } })
      return
    }
    router.push({ pathname: '/audiobook/[id]', params: { id: String(targetId) } })
  }

  return (
    <Pressable
      onPress={openPlayer}
      className="mx-2 mb-2 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-800"
      accessibilityRole="button"
      accessibilityLabel={t('audio.openPlayer')}
    >
      <View className="h-1 w-full bg-surface-200 dark:bg-surface-700">
        <View className="h-full bg-audio-500" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </View>

      <View className="flex-row items-center px-3 py-2.5">
        <View className="h-11 w-11 overflow-hidden rounded-lg bg-audio-100 dark:bg-audio-950">
          {current.cover ? (
            <Image
              source={{ uri: current.cover }}
              className="h-full w-full"
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="headset-outline" size={20} color={accent} />
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
          {/* Elapsed / total replaces a static label that said nothing useful. */}
          <Text numberOfLines={1} className="text-xs tabular-nums text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
            {durationMillis > 0
              ? `${formatTime(positionMillis)} / ${formatTime(durationMillis)}`
              : current.artist || t('books.audiobook')}
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
            accessibilityRole="button"
            accessibilityLabel={t('audio.previousChapter')}
          >
            <Ionicons name="play-skip-back" size={18} color={muted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={(event) => {
              event.stopPropagation()
              void skip(-SKIP_MILLIS)
            }}
            hitSlop={8}
            className="mr-1 rounded-full p-1.5"
            accessibilityRole="button"
            accessibilityLabel={t('audio.skipBack', { seconds: SKIP_MILLIS / 1000 })}
          >
            <Ionicons name="play-back" size={18} color={muted} />
          </Pressable>
        )}

        <Pressable
          onPress={(event) => {
            event.stopPropagation()
            void toggle()
          }}
          hitSlop={8}
          className="mr-1 rounded-full bg-audio-100 p-2 dark:bg-audio-950"
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('audio.pause') : t('audio.play')}
        >
          {isLoading ? (
            <ActivityIndicator color={accent} />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={accent} />
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
            accessibilityRole="button"
            accessibilityLabel={t('audio.nextChapter')}
          >
            <Ionicons name="play-skip-forward" size={18} color={muted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={(event) => {
              event.stopPropagation()
              void skip(SKIP_MILLIS)
            }}
            hitSlop={8}
            className="mr-1 rounded-full p-1.5"
            accessibilityRole="button"
            accessibilityLabel={t('audio.skipForward', { seconds: SKIP_MILLIS / 1000 })}
          >
            <Ionicons name="play-forward" size={18} color={muted} />
          </Pressable>
        )}

        <Pressable
          onPress={(event) => {
            event.stopPropagation()
            void stop()
          }}
          hitSlop={8}
          className="rounded-full p-1"
          accessibilityRole="button"
          accessibilityLabel={t('audio.closePlayer')}
        >
          <Ionicons name="close" size={19} color={muted} />
        </Pressable>
      </View>
    </Pressable>
  )
}
