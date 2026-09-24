import { memo, useCallback } from 'react'
import { View, Text, Pressable, ActivityIndicator, type TextStyle } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { SKIP_MILLIS, useAudioControls, useAudioProgress } from '@/context/AudioContext'
import { useI18n } from '@/context/I18nContext'
import { useTheme } from '@/context/ThemeContext'
import { useTypography } from '@/context/TypographyContext'
import { trackImage } from '@/lib/audio'

/** Rendered size of the cover thumbnail, in points. */
const THUMB_SIZE = 44

function formatTime(ms: number): string {
  if (!ms || ms < 0 || !isFinite(ms)) return '0:00'
  const total = Math.floor(ms / 1000)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const mm = hrs ? String(mins).padStart(2, '0') : String(mins)
  return `${hrs ? `${hrs}:` : ''}${mm}:${String(secs).padStart(2, '0')}`
}

/** The only parts that tick with playback; everything else re-renders on real state changes. */
const MiniProgressBar = memo(function MiniProgressBar() {
  const { positionMillis, durationMillis } = useAudioProgress()
  const progress = durationMillis > 0 ? Math.min(positionMillis / durationMillis, 1) : 0
  return (
    <View className="h-1 w-full bg-surface-200 dark:bg-surface-700" importantForAccessibility="no-hide-descendants">
      <View className="h-full bg-audio-500" style={{ width: `${progress * 100}%` }} />
    </View>
  )
})

const MiniTimeLabel = memo(function MiniTimeLabel({ fallback, style }: { fallback: string; style?: TextStyle }) {
  const { positionMillis, durationMillis } = useAudioProgress()
  return (
    <Text numberOfLines={1} className="text-xs tabular-nums text-surface-500 dark:text-surface-400" style={style}>
      {durationMillis > 0 ? `${formatTime(positionMillis)} / ${formatTime(durationMillis)}` : fallback}
    </Text>
  )
})

/** Global mini audio player shown above the tab bar while a track is loaded. */
export function MiniPlayer() {
  const { current, queue, isPlaying, isLoading, toggle, stop, next, previous, skip } = useAudioControls()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { isDark } = useTheme()
  const { t } = useI18n()

  const targetId = current?.sourceBookId
  const sourceType = current?.sourceType
  const openPlayer = useCallback(() => {
    if (targetId === undefined || targetId === null) return
    if (sourceType === 'article') {
      router.push({ pathname: '/articles/[id]', params: { id: String(targetId) } })
      return
    }
    router.push({ pathname: '/audiobook/[id]', params: { id: String(targetId) } })
  }, [targetId, sourceType])

  if (!current) return null

  // Icon colours follow the theme; they used to be hard-coded light-mode hexes.
  const accent = isDark ? '#d4a843' : '#c9922a'
  const muted = isDark ? '#94a3b8' : '#64748b'
  const hasQueue = queue.length > 1
  const cover = trackImage(current, THUMB_SIZE)
  const title = current.chapterTitle || current.title

  // The card is a plain container: nesting the buttons inside one big pressable
  // would hide them from screen readers, which treat it as a single element.
  return (
    <View className="mx-2 mb-2 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-800">
      <MiniProgressBar />

      <View className="flex-row items-center py-1.5 pl-3 pr-1">
        <Pressable
          onPress={openPlayer}
          className="min-h-11 flex-1 flex-row items-center pr-2"
          accessibilityRole="button"
          accessibilityLabel={`${t('audio.openPlayer')}: ${title}`}
        >
          <View className="h-11 w-11 overflow-hidden rounded-lg bg-audio-100 dark:bg-audio-950">
            {cover ? (
              <Image
                source={{ uri: cover }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
                accessible={false}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Ionicons name="headset-outline" size={20} color={accent} />
              </View>
            )}
          </View>

          <View className="ml-3 flex-1">
            <Text numberOfLines={1} className="text-sm text-surface-900 dark:text-surface-50" style={headerTextStyle}>
              {title}
            </Text>
            {/* Elapsed / total replaces a static label that said nothing useful. */}
            <MiniTimeLabel fallback={current.artist || t('books.audiobook')} style={bodyTextStyle} />
          </View>
        </Pressable>

        {hasQueue ? (
          <Pressable
            onPress={() => void previous()}
            hitSlop={4}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel={t('audio.previousChapter')}
          >
            <Ionicons name="play-skip-back" size={18} color={muted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void skip(-SKIP_MILLIS)}
            hitSlop={4}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel={t('audio.skipBack', { seconds: SKIP_MILLIS / 1000 })}
          >
            <Ionicons name="play-back" size={18} color={muted} />
          </Pressable>
        )}

        <Pressable
          onPress={() => void toggle()}
          hitSlop={2}
          className="mx-0.5 h-10 w-10 items-center justify-center rounded-full bg-audio-100 dark:bg-audio-950"
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('audio.pause') : t('audio.play')}
          accessibilityState={{ busy: isLoading }}
        >
          {isLoading ? (
            <ActivityIndicator color={accent} />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={accent} />
          )}
        </Pressable>

        {hasQueue ? (
          <Pressable
            onPress={() => void next()}
            hitSlop={4}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel={t('audio.nextChapter')}
          >
            <Ionicons name="play-skip-forward" size={18} color={muted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void skip(SKIP_MILLIS)}
            hitSlop={4}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel={t('audio.skipForward', { seconds: SKIP_MILLIS / 1000 })}
          >
            <Ionicons name="play-forward" size={18} color={muted} />
          </Pressable>
        )}

        <Pressable
          onPress={() => void stop()}
          hitSlop={4}
          className="h-10 w-10 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel={t('audio.closePlayer')}
        >
          <Ionicons name="close" size={19} color={muted} />
        </Pressable>
      </View>
    </View>
  )
}
