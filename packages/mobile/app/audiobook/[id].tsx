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
 *
 * Rendering: the screen subscribes to `useAudioControls` only. The seek bar and
 * the sleep countdown are the only pieces that subscribe to `useAudioProgress`,
 * so the chapter list does not re-render as the position ticks.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  type AccessibilityActionEvent,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ListRenderItem,
  type TextStyle,
} from 'react-native'
import { Image } from 'expo-image'
import { useReducedMotion } from 'react-native-reanimated'
import { router, useLocalSearchParams, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RequireAuth } from '@/components/RequireAuth'
import type { BookChapter } from '@loikmon/api'
import {
  PLAYBACK_RATES,
  SKIP_MILLIS,
  SLEEP_MINUTES,
  useAudioControls,
  useAudioProgress,
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
import { pickImage } from '@/lib/url'

/** Rendered width of the cover art, in points (w-48; 3:4 like every book cover). */
const COVER_SIZE = 192

type Palette = ReturnType<typeof iconPalette>

/** Ionicons take a colour prop, so the few icon colours live here rather than in classes. */
function iconPalette(isDark: boolean) {
  return {
    accent: isDark ? '#d4a843' : '#c9922a',
    strong: isDark ? '#f8fafc' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    onAccent: '#ffffff',
  }
}

const PALETTE_LIGHT = iconPalette(false)
const PALETTE_DARK = iconPalette(true)

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

/* ────────────────────────────────────────────────────────────── backdrop */

/**
 * Immersive "now playing" backdrop: the cover, heavily blurred, under a
 * theme-aware scrim — the Audible / Apple Books treatment. Every surface on
 * the screen is translucent so it inherits the book's colours, and the screen
 * reads as one piece in both themes instead of cards floating on a flat panel.
 *
 * The blur runs on the tiny xs rendition (150px), so it costs next to nothing.
 */
const PlayerBackdrop = memo(function PlayerBackdrop({ uri }: { uri: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <View style={StyleSheet.absoluteFill} className="bg-surface-50 dark:bg-surface-950" />
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.4 }] }]}
          contentFit="cover"
          blurRadius={60}
          cachePolicy="memory-disk"
          transition={300}
          accessible={false}
        />
      ) : null}
      {/* One even scrim (no stepped shading, which shows as a seam): keeps text
          at AA contrast whatever the cover colours are, and lets a hint of the
          cover's hue through. */}
      <View style={StyleSheet.absoluteFill} className="bg-surface-50/85 dark:bg-surface-950/85" />
    </View>
  )
})

/* ────────────────────────────────────────────────────────────── seek bar */

/**
 * Draggable scrubber.
 *
 * Tracks the finger, shows the position it would land on while dragging, and
 * commits on release. It uses the plain responder props rather than a
 * PanResponder, so there is no gesture object to rebuild when props change
 * mid-drag. Screen readers get an adjustable control with increment/decrement.
 */
function SeekBar({
  positionMillis,
  durationMillis,
  onSeek,
  label,
}: {
  positionMillis: number
  durationMillis: number
  onSeek: (millis: number) => void
  label: string
}) {
  const [width, setWidth] = useState(0)
  const [dragMillis, setDragMillis] = useState<number | null>(null)

  const shown = dragMillis ?? positionMillis
  const pct = durationMillis > 0 ? Math.min(1, Math.max(0, shown / durationMillis)) : 0

  const millisAt = (e: GestureResponderEvent) => {
    if (!width || !durationMillis) return 0
    return Math.max(0, Math.min(durationMillis, (e.nativeEvent.locationX / width) * durationMillis))
  }

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    const step = e.nativeEvent.actionName === 'increment' ? SKIP_MILLIS : -SKIP_MILLIS
    onSeek(Math.max(0, Math.min(durationMillis, positionMillis + step)))
  }

  return (
    <View className="px-6">
      <View
        onStartShouldSetResponder={() => durationMillis > 0}
        onMoveShouldSetResponder={() => durationMillis > 0}
        // Keep the drag when the list would like to scroll instead.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => setDragMillis(millisAt(e))}
        onResponderMove={(e) => setDragMillis(millisAt(e))}
        onResponderRelease={(e) => {
          const value = millisAt(e)
          setDragMillis(null)
          onSeek(value)
        }}
        onResponderTerminate={() => setDragMillis(null)}
        onLayout={onLayout}
        className="min-h-11 justify-center py-3"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{
          min: 0,
          max: Math.max(1, Math.floor(durationMillis / 1000)),
          now: Math.floor(shown / 1000),
          text: `${formatTime(shown)} / ${formatTime(durationMillis)}`,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
      >
        <View className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
          <View className="h-full rounded-full bg-audio-500" style={{ width: `${pct * 100}%` }} />
        </View>
        <View
          className="absolute h-4 w-4 rounded-full bg-audio-500"
          style={[styles.thumb, { left: Math.max(0, pct * width - 8) }]}
          pointerEvents="none"
        />
      </View>
      <View className="-mt-1 flex-row items-center justify-between" importantForAccessibility="no-hide-descendants">
        <Text className="text-xs tabular-nums text-surface-600 dark:text-surface-300">{formatTime(shown)}</Text>
        <Text className="text-xs tabular-nums text-surface-600 dark:text-surface-300">
          {formatTime(durationMillis)}
        </Text>
      </View>
    </View>
  )
}

/** The seek bar is the one part of the transport that follows the position. */
const ProgressSeekBar = memo(function ProgressSeekBar({
  active,
  onSeek,
  label,
}: {
  active: boolean
  onSeek: (millis: number) => void
  label: string
}) {
  const { positionMillis, durationMillis } = useAudioProgress()
  return (
    <SeekBar
      positionMillis={active ? positionMillis : 0}
      durationMillis={active ? durationMillis : 0}
      onSeek={onSeek}
      label={label}
    />
  )
})

/** Sleep chip label; only a running timer needs the per-second countdown. */
const SleepLabel = memo(function SleepLabel({ mode, className }: { mode: SleepMode; className: string }) {
  const { t } = useI18n()
  const { sleepRemainingMs } = useAudioProgress()
  const label =
    mode === 'off'
      ? t('audio.sleepTimer')
      : mode === 'end-of-chapter'
        ? t('audio.sleepEndOfChapter')
        : sleepRemainingMs !== null
          ? formatTime(sleepRemainingMs)
          : `${mode}m`
  return <Text className={className}>{label}</Text>
})

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
  colors,
  closeLabel,
}: {
  visible: boolean
  title: string
  options: SheetOption[]
  selected: SleepMode | number
  onSelect: (value: SleepMode | number) => void
  onClose: () => void
  colors: Palette
  closeLabel: string
}) {
  const reduceMotion = useReducedMotion()
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        {/* Backdrop tap closes; it is a separate sibling so the sheet's options stay reachable. */}
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View className="rounded-t-3xl bg-white px-5 pb-8 pt-4 dark:bg-surface-900" accessibilityViewIsModal>
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-surface-300 dark:bg-surface-700" />
          <Text className="mb-2 text-base font-bold text-surface-900 dark:text-white" accessibilityRole="header">
            {title}
          </Text>
          <View accessibilityRole="radiogroup">
            {options.map((option) => {
              const active = option.value === selected
              return (
                <Pressable
                  key={String(option.value)}
                  onPress={() => onSelect(option.value)}
                  className="min-h-11 flex-row items-center justify-between rounded-2xl px-3 py-3"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
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
          </View>
        </View>
      </View>
    </Modal>
  )
}

/* ─────────────────────────────────────────────────────────── chapter row */

interface ChapterRowProps {
  chapter: BookChapter
  index: number
  active: boolean
  playing: boolean
  disabled?: boolean
  onSelect: (chapter: BookChapter) => void
  colors: Palette
  textStyle: TextStyle | undefined
  labels: { locked: string; playing: string; tapToPlay: string }
}

const ChapterRow = memo(function ChapterRow({
  chapter,
  index,
  active,
  playing,
  disabled = false,
  onSelect,
  colors,
  textStyle,
  labels,
}: ChapterRowProps) {
  const locked = chapter.locked || !chapter.audio_url
  const length = formatChapterLength(chapter.duration_seconds ?? chapter.duration)
  const title = chapter.chapter_title || chapter.title
  const status = locked ? labels.locked : active && playing ? labels.playing : labels.tapToPlay
  return (
    <Pressable
      onPress={() => onSelect(chapter)}
      disabled={disabled}
      className={`mx-6 mb-2 min-h-11 flex-row items-center gap-3 rounded-2xl border px-3 py-3 ${
        active
          ? 'border-audio-500/50 bg-audio-500/15 dark:border-audio-400/40 dark:bg-audio-400/15'
          : 'border-black/5 bg-white/70 dark:border-white/10 dark:bg-white/5'
      }`}
      accessibilityRole="button"
      accessibilityLabel={`${index + 1}. ${title}${length ? `, ${length}` : ''}`}
      accessibilityHint={status}
      accessibilityState={{ selected: active, disabled }}
    >
      <View
        className={`h-8 w-8 items-center justify-center rounded-xl ${
          active ? 'bg-audio-500' : 'bg-black/5 dark:bg-white/10'
        }`}
      >
        <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-surface-500 dark:text-surface-300'}`}>
          {index + 1}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-surface-900 dark:text-white" numberOfLines={1} style={textStyle}>
          {title}
        </Text>
        <Text className="text-xs text-surface-500 dark:text-surface-400">
          {status}
          {length ? ` · ${length}` : ''}
        </Text>
      </View>
      <Ionicons
        name={locked ? 'lock-closed' : active && playing ? 'pause' : 'play'}
        size={18}
        color={locked ? colors.muted : colors.accent}
      />
    </Pressable>
  )
})

const chapterKey = (chapter: BookChapter) => String(chapter.id)

/* ────────────────────────────────────────────────────────────── screen */

export default function AudiobookScreen() {
  return (
    <RequireAuth>
      <AudiobookContent />
    </RequireAuth>
  )
}

function AudiobookContent() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = firstParam(params.id)
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()
  const { isDark } = useTheme()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const colors = isDark ? PALETTE_DARK : PALETTE_LIGHT

  const { book } = useBookDetail(id, { trackView: false })
  const cover = book ? pickImage(book, COVER_SIZE) : ''
  // Smallest rendition: it is blurred to a wash, so detail is wasted bytes.
  const backdrop = book ? pickImage(book, 40) : ''
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
    play,
    toggle,
    seek,
    skip,
    next,
    previous,
    rate,
    setRate,
    sleepMode,
    setSleep,
    error: playbackError,
    lockedAction,
    retry,
    getPositionMillis,
  } = useAudioControls()

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
  const atLastChapter = !isThisBook || currentIndex >= queue.length - 1
  const activeChapterId = isThisBook ? String(current?.chapterId ?? '') : null
  const showPlaying = isPlaying && isThisBook

  const onToggle = useCallback(() => {
    // First press on a fresh screen starts the book; there is no autoplay.
    if (!isThisBook && hasTracks) void play(tracks[0], tracks)
    else void toggle()
  }, [isThisBook, hasTracks, tracks, play, toggle])

  const onPrev = useCallback(() => {
    // Read the position on demand rather than re-rendering the screen as it ticks.
    if (getPositionMillis() > 3000) void seek(0)
    else void previous()
  }, [getPositionMillis, seek, previous])

  // Stable, so the seek bar never swaps handlers in the middle of a drag.
  const onSeek = useCallback((millis: number) => void seek(millis), [seek])

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

  const rowLabels = useMemo(
    () => ({ locked: t('audio.locked'), playing: t('audio.playing'), tapToPlay: t('audio.tapToPlay') }),
    [t],
  )

  const renderChapter = useCallback<ListRenderItem<BookChapter>>(
    ({ item, index }) => (
      <ChapterRow
        chapter={item}
        index={index}
        active={activeChapterId === String(item.id)}
        playing={isPlaying && activeChapterId === String(item.id)}
        disabled={item.locked && accessAction(access, isLoggedIn) === 'subscribe'}
        onSelect={onSelectChapter}
        colors={colors}
        textStyle={bodyTextStyle}
        labels={rowLabels}
      />
    ),
    [activeChapterId, isPlaying, onSelectChapter, access, isLoggedIn, colors, bodyTextStyle, rowLabels],
  )

  const onSelectSpeed = useCallback(
    (v: SleepMode | number) => {
      setRate(v as number)
      setSpeedOpen(false)
    },
    [setRate],
  )
  const onSelectSleep = useCallback(
    (v: SleepMode | number) => {
      setSleep(v as SleepMode)
      setSleepOpen(false)
    },
    [setSleep],
  )
  const closeSpeed = useCallback(() => setSpeedOpen(false), [])
  const closeSleep = useCallback(() => setSleepOpen(false), [])

  const header = (
    <>
      <View className="items-center px-6 pt-2">
        <View className="h-64 w-48 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/10" style={styles.cover}>
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
              <Ionicons name="headset-outline" size={48} color={colors.accent} />
            </View>
          )}
        </View>

        <Text
          className="mt-6 text-center text-2xl font-bold text-surface-900 dark:text-white"
          numberOfLines={2}
          style={headerTextStyle}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {author ? (
          <Text className="mt-1 text-base text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
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
        <ProgressSeekBar active={isThisBook} onSeek={onSeek} label={t('audio.position')} />
      </View>

      {/* Transport */}
      <View className="mt-2 flex-row items-center justify-center gap-4 px-6">
        <Pressable
          onPress={onPrev}
          disabled={!isThisBook}
          hitSlop={4}
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
          hitSlop={4}
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
          accessibilityLabel={showPlaying ? t('audio.pause') : t('audio.play')}
          accessibilityState={{ disabled: !hasTracks, busy: isLoading && isThisBook }}
        >
          {isLoading && isThisBook ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Ionicons
              name={showPlaying ? 'pause' : 'play'}
              size={34}
              color={colors.onAccent}
              style={{ marginLeft: showPlaying ? 0 : 3 }}
            />
          )}
        </Pressable>

        <Pressable
          onPress={() => void skip(SKIP_MILLIS)}
          disabled={!isThisBook}
          hitSlop={4}
          className="h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
          accessibilityRole="button"
          accessibilityLabel={t('audio.skipForward', { seconds: SKIP_MILLIS / 1000 })}
          accessibilityState={{ disabled: !isThisBook }}
        >
          <Ionicons name="play-forward" size={22} color={colors.strong} />
        </Pressable>

        <Pressable
          onPress={() => void next()}
          disabled={atLastChapter}
          hitSlop={4}
          className="h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
          accessibilityRole="button"
          accessibilityLabel={t('audio.nextChapter')}
          accessibilityState={{ disabled: atLastChapter }}
        >
          <Ionicons name="play-skip-forward" size={22} color={colors.strong} />
        </Pressable>
      </View>

      {/* Speed + sleep timer */}
      <View className="mt-5 flex-row items-center justify-center gap-3 px-6">
        <Pressable
          onPress={() => setSpeedOpen(true)}
          className={`min-h-11 flex-row items-center gap-1.5 rounded-full px-4 py-2 ${
            rate !== 1 ? 'bg-audio-500/15 dark:bg-audio-400/15' : 'bg-black/5 dark:bg-white/10'
          }`}
          accessibilityRole="button"
          accessibilityLabel={`${t('audio.speed')}, ${rate === 1 ? t('audio.normalSpeed') : `${rate}×`}`}
          accessibilityState={{ expanded: speedOpen }}
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
          className={`min-h-11 flex-row items-center gap-1.5 rounded-full px-4 py-2 ${
            sleepMode !== 'off' ? 'bg-audio-500/15 dark:bg-audio-400/15' : 'bg-black/5 dark:bg-white/10'
          }`}
          accessibilityRole="button"
          accessibilityLabel={
            sleepMode === 'off'
              ? t('audio.sleepTimer')
              : `${t('audio.sleepTimer')}, ${
                  sleepMode === 'end-of-chapter' ? t('audio.sleepEndOfChapter') : t('audio.sleepMinutes', { count: sleepMode })
                }`
          }
          accessibilityState={{ expanded: sleepOpen, checked: sleepMode !== 'off' }}
        >
          <Ionicons name="moon-outline" size={16} color={sleepMode !== 'off' ? colors.accent : colors.muted} />
          <SleepLabel
            mode={sleepMode}
            className={`text-xs font-bold ${
              sleepMode !== 'off' ? 'text-audio-600 dark:text-audio-400' : 'text-surface-600 dark:text-surface-300'
            }`}
          />
        </Pressable>
      </View>

      {/* Playback failed even after re-signing the URL: offer a retry. */}
      {playbackError && isThisBook ? (
        <Pressable
          onPress={() => void retry()}
          className="mx-6 mt-5 min-h-11 flex-row items-center gap-2 rounded-2xl bg-audio-500/15 px-4 py-3 dark:bg-audio-400/15"
          accessibilityRole="button"
          accessibilityLabel={`${playbackError === 'unavailable' ? t('audio.unavailable') : t('audio.playbackFailed')} ${t('common.retry')}`}
          accessibilityLiveRegion="assertive"
        >
          <Ionicons name="alert-circle" size={16} color={colors.accent} />
          <Text className="flex-1 text-xs font-semibold text-audio-700 dark:text-audio-300" style={bodyTextStyle}>
            {playbackError === 'unavailable' ? t('audio.unavailable') : t('audio.playbackFailed')}
          </Text>
          <Text className="text-xs font-bold text-audio-600 underline dark:text-audio-400">{t('common.retry')}</Text>
        </Pressable>
      ) : null}

      {lockedCount > 0 ? (
        <Pressable
          onPress={() => router.push(accessAction(access, isLoggedIn) === 'login' ? '/(auth)/login' : '/subscribe')}
          disabled={accessAction(access, isLoggedIn) === 'subscribe'}
          className="mx-6 mt-4 min-h-11 flex-row items-center gap-2 rounded-2xl bg-black/5 px-4 py-3 dark:bg-white/10"
          accessibilityRole="button"
          accessibilityLabel={t('audio.lockedHint', { count: lockedCount })}
          accessibilityState={{ disabled: accessAction(access, isLoggedIn) === 'subscribe' }}
        >
          <Ionicons name="lock-closed" size={16} color={colors.accent} />
          <Text className="flex-1 text-xs font-semibold text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
            {t('audio.lockedHint', { count: lockedCount })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ) : null}

      {/* Chapters */}
      <View className="mb-3 mt-6 flex-row items-center justify-between px-6">
        <Text
          className="text-xs font-bold uppercase tracking-widest text-surface-600 dark:text-surface-300"
          style={headerTextStyle}
          accessibilityRole="header"
        >
          {t('audio.playlist')}
        </Text>
        <Text className="text-xs text-surface-500 dark:text-surface-400">
          {chapterCount ? t('audio.chapterOf', { current: displayIndex + 1, total: chapterCount }) : ''}
        </Text>
      </View>
    </>
  )

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <PlayerBackdrop uri={backdrop} />

      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={4}
          className="h-11 w-11 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.strong} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(id) } })}
          hitSlop={8}
          className="min-h-9 flex-row items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10"
          accessibilityRole="button"
          accessibilityLabel={t('audio.read')}
        >
          <Ionicons name="book-outline" size={14} color={colors.muted} />
          <Text className="text-xs font-semibold text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
            {t('audio.read')}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={sortedChapters}
        keyExtractor={chapterKey}
        renderItem={renderChapter}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text className="px-6 py-6 text-center text-sm text-surface-400 dark:text-surface-500" style={bodyTextStyle}>
            {chaptersLoading ? t('common.loading') : t('audio.noChapters')}
          </Text>
        }
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
      />

      <OptionSheet
        visible={speedOpen}
        title={t('audio.speed')}
        options={speedOptions}
        selected={rate}
        onSelect={onSelectSpeed}
        onClose={closeSpeed}
        colors={colors}
        closeLabel={t('common.close')}
      />
      <OptionSheet
        visible={sleepOpen}
        title={t('audio.sleepTimer')}
        options={sleepOptions}
        selected={sleepMode}
        onSelect={onSelectSleep}
        onClose={closeSleep}
        colors={colors}
        closeLabel={t('common.close')}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  thumb: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
})
