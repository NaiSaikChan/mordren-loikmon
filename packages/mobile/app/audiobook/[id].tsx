/**
 * Full-screen audiobook player.
 *
 * Styled with NativeWind against the shared `audio` / `surface` tokens and the
 * listener's own theme and font preferences, so it belongs to the same app as
 * every other screen. Chapters come from `books.getChapters`: locked chapters
 * have no audio URL and are never queued or played.
 *
 * Playback does not start on its own — opening a screen should not spend
 * someone's mobile data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { router, useLocalSearchParams, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { BookChapter } from '@loikmon/api'
import {
  PLAYBACK_RATES,
  SKIP_MILLIS,
  SLEEP_MINUTES,
  useAudio,
  type SleepMode,
} from '@/context/AudioContext'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTheme } from '@/context/ThemeContext'
import { useTypography } from '@/context/TypographyContext'
import { useBookAudioChapters } from '@/hooks/useBookAudioChapters'
import { useBookDetail } from '@/hooks/useBooks'
import { accessAction } from '@/lib/access'
import type { AudioTrack } from '@/lib/audio'
import { firstParam } from '@/lib/normalize'
import { pickCover } from '@/lib/url'

/** Ionicons take a colour prop, so the few icon colours live here rather than in classes. */
function iconPalette(isDark: boolean) {
  return {
    accent: isDark ? '#d4a843' : '#c9922a',
    strong: isDark ? '#f8fafc' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    onAccent: '#ffffff',
  }
}

function formatTime(ms: number): string {
  if (!ms || ms < 0 || !isFinite(ms)) return '0:00'
  const total = Math.floor(ms / 1000)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const mm = hrs ? String(mins).padStart(2, '0') : String(mins)
  return `${hrs ? `${hrs}:` : ''}${mm}:${String(secs).padStart(2, '0')}`
}

function formatChapterLength(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  return formatTime(seconds * 1000)
}

/* ────────────────────────────────────────────────────────────── seek bar */

/**
 * Draggable scrubber.
 *
 * The previous version only accepted a tap. This tracks the finger, shows the
 * position it would land on while dragging, and commits on release — and is
 * exposed to screen readers as an adjustable control.
 */
function SeekBar({
  positionMillis,
  durationMillis,
  onSeek,
  isDark,
  label,
}: {
  positionMillis: number
  durationMillis: number
  onSeek: (millis: number) => void
  isDark: boolean
  label: string
}) {
  const [width, setWidth] = useState(0)
  const [dragMillis, setDragMillis] = useState<number | null>(null)

  // PanResponder callbacks are created once, so live values are read from refs.
  const widthRef = useRef(0)
  const durationRef = useRef(0)
  widthRef.current = width
  durationRef.current = durationMillis

  const shown = dragMillis ?? positionMillis
  const pct = durationMillis > 0 ? Math.min(1, Math.max(0, shown / durationMillis)) : 0

  const millisAt = useCallback((x: number) => {
    if (!widthRef.current || !durationRef.current) return 0
    return Math.max(0, Math.min(durationRef.current, (x / widthRef.current) * durationRef.current))
  }, [])

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setDragMillis(millisAt(e.nativeEvent.locationX)),
        onPanResponderMove: (e) => setDragMillis(millisAt(e.nativeEvent.locationX)),
        onPanResponderRelease: (e) => {
          const value = millisAt(e.nativeEvent.locationX)
          setDragMillis(null)
          onSeek(value)
        },
        onPanResponderTerminate: () => setDragMillis(null),
      }),
    [millisAt, onSeek],
  )

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  return (
    <View className="px-6">
      <View
        {...responder.panHandlers}
        onLayout={onLayout}
        className="justify-center py-3"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{
          min: 0,
          max: Math.max(1, Math.floor(durationMillis / 1000)),
          now: Math.floor(shown / 1000),
          text: formatTime(shown),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const step = e.nativeEvent.actionName === 'increment' ? 5000 : -5000
          onSeek(Math.max(0, Math.min(durationMillis, positionMillis + step)))
        }}
      >
        <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
          <View className="h-full rounded-full bg-audio-500" style={{ width: `${pct * 100}%` }} />
        </View>
        <View
          className="absolute h-4 w-4 rounded-full border-2 border-white bg-audio-500 dark:border-surface-900"
          style={{ left: Math.max(0, pct * width - 8) }}
          pointerEvents="none"
        />
      </View>
      <View className="-mt-1 flex-row items-center justify-between">
        <Text className="text-xs tabular-nums text-surface-500 dark:text-surface-400">{formatTime(shown)}</Text>
        <Text className="text-xs tabular-nums text-surface-500 dark:text-surface-400">
          {formatTime(durationMillis)}
        </Text>
      </View>
    </View>
  )
}

/* ──────────────────────────────────────────────────────── option sheet */

interface SheetOption {
  value: SleepMode | number
  label: string
}

/** Bottom sheet for a single choice (speed, sleep timer). */
function OptionSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  isDark,
}: {
  visible: boolean
  title: string
  options: SheetOption[]
  selected: SleepMode | number
  onSelect: (value: SleepMode | number) => void
  onClose: () => void
  isDark: boolean
}) {
  const colors = iconPalette(isDark)
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose} accessibilityLabel={title}>
        <Pressable
          className="rounded-t-3xl bg-white px-5 pb-8 pt-4 dark:bg-surface-900"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-surface-300 dark:bg-surface-700" />
          <Text className="mb-2 text-base font-bold text-surface-900 dark:text-white">{title}</Text>
          {options.map((option) => {
            const active = option.value === selected
            return (
              <Pressable
                key={String(option.value)}
                onPress={() => onSelect(option.value)}
                className="flex-row items-center justify-between rounded-2xl px-3 py-3"
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
              >
                <Text
                  className={
                    active
                      ? 'text-base font-bold text-audio-600 dark:text-audio-400'
                      : 'text-base text-surface-700 dark:text-surface-200'
                  }
                >
                  {option.label}
                </Text>
                {active ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
              </Pressable>
            )
          })}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/* ────────────────────────────────────────────────────────────── screen */

export default function AudiobookScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = firstParam(params.id)
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()
  const { isDark } = useTheme()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const colors = iconPalette(isDark)

  const { book } = useBookDetail(id, { trackView: false })
  const cover = book ? pickCover(book) : ''
  const title = book?.title ?? ''
  const author = book?.authorname ?? ''

  const { chapters, tracks, access, lockedCount, loading: chaptersLoading } = useBookAudioChapters(
    id,
    book ?? undefined,
  )
  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.chapter_number - b.chapter_number),
    [chapters],
  )

  const {
    current,
    currentIndex,
    queue,
    isPlaying,
    isLoading,
    positionMillis,
    durationMillis,
    play,
    toggle,
    seek,
    skip,
    next,
    previous,
    rate,
    setRate,
    sleepMode,
    sleepRemainingMs,
    setSleep,
    error: playbackError,
    lockedAction,
    retry,
  } = useAudio()

  const [speedOpen, setSpeedOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)

  // Signed URLs change on every fetch, so identify the book's queue by book id.
  const isThisBook = current?.sourceType === 'book' && String(current.sourceBookId) === String(id)

  // Access lost mid-session (signed out elsewhere, subscription lapsed): send
  // them where they can fix it rather than leaving a player that will not start.
  useEffect(() => {
    if (!lockedAction) return
    router.push(lockedAction === 'login' ? '/(auth)/login' : '/subscribe')
  }, [lockedAction])

  const displayIndex = isThisBook ? currentIndex : 0
  const chapterCount = isThisBook ? queue.length : tracks.length
  const currentTrack = isThisBook ? current : (tracks[0] ?? null)
  const chapterDisplayTitle = currentTrack?.chapterTitle ?? currentTrack?.title ?? ''
  const hasTracks = tracks.length > 0

  const onToggle = useCallback(() => {
    // First press on a fresh screen starts the book; there is no autoplay.
    if (!isThisBook && hasTracks) void play(tracks[0], tracks)
    else void toggle()
  }, [isThisBook, hasTracks, tracks, play, toggle])

  const onPrev = useCallback(() => {
    if (positionMillis > 3000) void seek(0)
    else void previous()
  }, [positionMillis, seek, previous])

  const onSelectChapter = useCallback(
    (chapter: BookChapter) => {
      const track: AudioTrack | undefined = tracks.find((item) => String(item.id) === String(chapter.id))
      if (!track || chapter.locked) {
        // Locked: never play — send the viewer to sign in or subscribe.
        router.push(accessAction(access, isLoggedIn) === 'login' ? '/(auth)/login' : '/subscribe')
        return
      }
      void play(track, tracks)
    },
    [play, tracks, access, isLoggedIn],
  )

  const speedOptions = useMemo<SheetOption[]>(
    () => PLAYBACK_RATES.map((value) => ({ value, label: value === 1 ? t('audio.normalSpeed') : `${value}×` })),
    [t],
  )

  const sleepOptions = useMemo<SheetOption[]>(
    () => [
      { value: 'off' as SleepMode, label: t('audio.sleepOff') },
      ...SLEEP_MINUTES.map((m) => ({ value: m as SleepMode, label: t('audio.sleepMinutes', { count: m }) })),
      { value: 'end-of-chapter' as SleepMode, label: t('audio.sleepEndOfChapter') },
    ],
    [t],
  )

  const sleepLabel =
    sleepMode === 'off'
      ? t('audio.sleepTimer')
      : sleepMode === 'end-of-chapter'
        ? t('audio.sleepEndOfChapter')
        : sleepRemainingMs !== null
          ? formatTime(sleepRemainingMs)
          : `${sleepMode}m`

  return (
    <SafeAreaView className="flex-1 bg-surface-50 dark:bg-surface-950" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.strong} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(id) } })}
          hitSlop={12}
          className="flex-row items-center gap-1 rounded-full bg-surface-100 px-3 py-1.5 dark:bg-surface-800"
          accessibilityRole="button"
          accessibilityLabel={t('audio.read')}
        >
          <Ionicons name="book-outline" size={14} color={colors.muted} />
          <Text className="text-xs font-semibold text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
            {t('audio.read')}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        <View className="items-center px-6 pt-2">
          <View className="h-44 w-44 overflow-hidden rounded-3xl bg-audio-100 shadow-lg dark:bg-audio-950">
            {cover ? (
              <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Ionicons name="headset-outline" size={48} color={colors.accent} />
              </View>
            )}
          </View>

          <Text
            className="mt-5 text-center text-xl font-bold text-surface-900 dark:text-white"
            numberOfLines={2}
            style={headerTextStyle}
          >
            {title}
          </Text>
          {author ? (
            <Text className="mt-1 text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
              {author}
            </Text>
          ) : null}

          {chapterDisplayTitle ? (
            <Text
              className="mt-3 text-center text-sm font-semibold text-audio-600 dark:text-audio-400"
              numberOfLines={1}
              accessibilityLiveRegion="polite"
              style={bodyTextStyle}
            >
              {chapterDisplayTitle}
            </Text>
          ) : null}
        </View>

        <View className="mt-4">
          <SeekBar
            positionMillis={isThisBook ? positionMillis : 0}
            durationMillis={isThisBook ? durationMillis : 0}
            onSeek={(ms) => void seek(ms)}
            isDark={isDark}
            label={t('audio.position')}
          />
        </View>

        {/* Transport */}
        <View className="mt-2 flex-row items-center justify-center gap-4 px-6">
          <Pressable
            onPress={onPrev}
            disabled={!isThisBook}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
            accessibilityRole="button"
            accessibilityLabel={t('audio.previousChapter')}
            accessibilityState={{ disabled: !isThisBook }}
          >
            <Ionicons name="play-skip-back" size={22} color={colors.strong} />
          </Pressable>

          <Pressable
            onPress={() => void skip(-SKIP_MILLIS)}
            disabled={!isThisBook}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
            accessibilityRole="button"
            accessibilityLabel={t('audio.skipBack', { seconds: SKIP_MILLIS / 1000 })}
            accessibilityState={{ disabled: !isThisBook }}
          >
            <Ionicons name="play-back" size={22} color={colors.strong} />
          </Pressable>

          <Pressable
            onPress={onToggle}
            disabled={!hasTracks}
            className="h-20 w-20 items-center justify-center rounded-full bg-audio-500 shadow-lg disabled:opacity-40"
            accessibilityRole="button"
            accessibilityLabel={isPlaying && isThisBook ? t('audio.pause') : t('audio.play')}
            accessibilityState={{ disabled: !hasTracks }}
          >
            {isLoading && isThisBook ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Ionicons
                name={isPlaying && isThisBook ? 'pause' : 'play'}
                size={34}
                color={colors.onAccent}
                style={{ marginLeft: isPlaying && isThisBook ? 0 : 3 }}
              />
            )}
          </Pressable>

          <Pressable
            onPress={() => void skip(SKIP_MILLIS)}
            disabled={!isThisBook}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
            accessibilityRole="button"
            accessibilityLabel={t('audio.skipForward', { seconds: SKIP_MILLIS / 1000 })}
            accessibilityState={{ disabled: !isThisBook }}
          >
            <Ionicons name="play-forward" size={22} color={colors.strong} />
          </Pressable>

          <Pressable
            onPress={() => void next()}
            disabled={!isThisBook || currentIndex >= queue.length - 1}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
            accessibilityRole="button"
            accessibilityLabel={t('audio.nextChapter')}
            accessibilityState={{ disabled: !isThisBook || currentIndex >= queue.length - 1 }}
          >
            <Ionicons name="play-skip-forward" size={22} color={colors.strong} />
          </Pressable>
        </View>

        {/* Speed + sleep timer */}
        <View className="mt-5 flex-row items-center justify-center gap-3 px-6">
          <Pressable
            onPress={() => setSpeedOpen(true)}
            className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
              rate !== 1 ? 'bg-audio-100 dark:bg-audio-950' : 'bg-surface-100 dark:bg-surface-800'
            }`}
            accessibilityRole="button"
            accessibilityLabel={t('audio.speed')}
          >
            <Ionicons name="speedometer-outline" size={16} color={rate !== 1 ? colors.accent : colors.muted} />
            <Text
              className={`text-xs font-bold ${
                rate !== 1 ? 'text-audio-600 dark:text-audio-400' : 'text-surface-600 dark:text-surface-300'
              }`}
            >
              {rate === 1 ? '1×' : `${rate}×`}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSleepOpen(true)}
            className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
              sleepMode !== 'off' ? 'bg-audio-100 dark:bg-audio-950' : 'bg-surface-100 dark:bg-surface-800'
            }`}
            accessibilityRole="button"
            accessibilityLabel={t('audio.sleepTimer')}
          >
            <Ionicons name="moon-outline" size={16} color={sleepMode !== 'off' ? colors.accent : colors.muted} />
            <Text
              className={`text-xs font-bold ${
                sleepMode !== 'off' ? 'text-audio-600 dark:text-audio-400' : 'text-surface-600 dark:text-surface-300'
              }`}
            >
              {sleepLabel}
            </Text>
          </Pressable>
        </View>

        {/* Playback failed even after re-signing the URL: offer a retry. */}
        {playbackError && isThisBook ? (
          <Pressable
            onPress={() => void retry()}
            className="mx-6 mt-5 flex-row items-center gap-2 rounded-2xl bg-audio-50 px-4 py-3 dark:bg-audio-950"
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Ionicons name="alert-circle" size={16} color={colors.accent} />
            <Text className="flex-1 text-xs font-semibold text-audio-700 dark:text-audio-300" style={bodyTextStyle}>
              {playbackError === 'unavailable' ? t('audio.unavailable') : t('audio.playbackFailed')}
            </Text>
            <Text className="text-xs font-bold text-audio-600 underline dark:text-audio-400">
              {t('common.retry')}
            </Text>
          </Pressable>
        ) : null}

        {lockedCount > 0 ? (
          <Pressable
            onPress={() => router.push(accessAction(access, isLoggedIn) === 'login' ? '/(auth)/login' : '/subscribe')}
            className="mx-6 mt-4 flex-row items-center gap-2 rounded-2xl bg-surface-100 px-4 py-3 dark:bg-surface-800"
            accessibilityRole="button"
            accessibilityLabel={t('audio.lockedHint', { count: lockedCount })}
          >
            <Ionicons name="lock-closed" size={16} color={colors.accent} />
            <Text className="flex-1 text-xs font-semibold text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
              {t('audio.lockedHint', { count: lockedCount })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        ) : null}

        {/* Chapters */}
        <View className="mt-6 px-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              className="text-xs font-bold uppercase tracking-widest text-surface-500 dark:text-surface-400"
              style={headerTextStyle}
            >
              {t('audio.playlist')}
            </Text>
            <Text className="text-xs text-surface-400 dark:text-surface-500">
              {chapterCount ? t('audio.chapterOf', { current: displayIndex + 1, total: chapterCount }) : ''}
            </Text>
          </View>

          {sortedChapters.length === 0 ? (
            <Text className="py-6 text-center text-sm text-surface-400 dark:text-surface-500" style={bodyTextStyle}>
              {chaptersLoading ? t('common.loading') : t('audio.noChapters')}
            </Text>
          ) : (
            sortedChapters.map((chapter, idx) => {
              const locked = chapter.locked || !chapter.audio_url
              const active = isThisBook && String(current?.chapterId ?? '') === String(chapter.id)
              const length = formatChapterLength(chapter.duration_seconds ?? chapter.duration)
              return (
                <Pressable
                  key={String(chapter.id)}
                  onPress={() => onSelectChapter(chapter)}
                  className={`mb-2 flex-row items-center gap-3 rounded-2xl border px-3 py-3 ${
                    active
                      ? 'border-audio-400 bg-audio-50 dark:border-audio-700 dark:bg-audio-950'
                      : 'border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={chapter.chapter_title || chapter.title}
                  accessibilityHint={locked ? t('audio.locked') : undefined}
                >
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-xl ${
                      active ? 'bg-audio-500' : 'bg-surface-100 dark:bg-surface-800'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${active ? 'text-white' : 'text-surface-500 dark:text-surface-300'}`}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-sm font-semibold text-surface-900 dark:text-white"
                      numberOfLines={1}
                      style={bodyTextStyle}
                    >
                      {chapter.chapter_title || chapter.title}
                    </Text>
                    <Text className="text-xs text-surface-400 dark:text-surface-500">
                      {locked ? t('audio.locked') : active && isPlaying ? t('audio.playing') : t('audio.tapToPlay')}
                      {length ? ` · ${length}` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={locked ? 'lock-closed' : active && isPlaying ? 'pause' : 'play'}
                    size={18}
                    color={locked ? colors.muted : colors.accent}
                  />
                </Pressable>
              )
            })
          )}
        </View>
      </ScrollView>

      <OptionSheet
        visible={speedOpen}
        title={t('audio.speed')}
        options={speedOptions}
        selected={rate}
        onSelect={(v) => {
          setRate(v as number)
          setSpeedOpen(false)
        }}
        onClose={() => setSpeedOpen(false)}
        isDark={isDark}
      />
      <OptionSheet
        visible={sleepOpen}
        title={t('audio.sleepTimer')}
        options={sleepOptions}
        selected={sleepMode}
        onSelect={(v) => {
          setSleep(v as SleepMode)
          setSleepOpen(false)
        }}
        onClose={() => setSleepOpen(false)}
        isDark={isDark}
      />
    </SafeAreaView>
  )
}
