/**
 * Full-screen Audiobook Player
 *
 * Design: warm gold (#C9922A / #D4A843) accent on light (#F5F5F0) background.
 * Layout:
 *   ─ Header: back arrow  |  "Read" button
 *   ─ Cover art (rounded square, shadow)
 *   ─ Book title + author
 *   ─ Large arc/semicircle decorative shape behind playback controls
 *   ─ Playback controls: skip-back-15  play/pause  skip-forward-15
 *   ─ Seek bar with current / total time
 *   ─ Lyrics / description text area
 *   ─ Footer: < Chapter N of M >  |  Page N/total
 */
import { useCallback, useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAudio } from '@/context/AudioContext'
import { useBookAudioChapters } from '@/hooks/useBookAudioChapters'
import { useBookDetail } from '@/hooks/useBooks'
import { pickCover } from '@/lib/url'

const GOLD = '#C9922A'
const GOLD_LIGHT = '#D4A843'
const BG = '#F5F5F0'
const TEXT_DARK = '#1A1A1A'
const TEXT_MID = '#6B6B6B'
const TEXT_LIGHT = '#A0A0A0'
const TRACK_BG = '#E0D8CC'

const { width: SW } = Dimensions.get('window')
const COVER_SIZE = Math.min(SW * 0.42, 180)
const ARC_RADIUS = SW * 0.62

function formatTime(ms: number): string {
  if (!ms || ms < 0) return '0:00'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function SeekBar({
  positionMillis,
  durationMillis,
  onSeek,
}: {
  positionMillis: number
  durationMillis: number
  onSeek: (ms: number) => void
}) {
  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0
  const barRef = useRef<View>(null)

  const handlePress = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (!barRef.current) return
      barRef.current.measure((_x: number, _y: number, width: number) => {
        if (!width) return
        const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / width))
        onSeek(ratio * durationMillis)
      })
    },
    [durationMillis, onSeek],
  )

  return (
    <View style={styles.seekContainer}>
      <Pressable
        ref={barRef as any}
        onPress={handlePress as any}
        style={styles.trackOuter}
        hitSlop={12}
      >
        <View style={styles.trackBg} />
        <View style={[styles.trackFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
        <View style={[styles.thumb, { left: `${Math.min(progress * 100, 100)}%` as any, marginLeft: -7 }]} />
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
        <Text style={styles.timeText}>{formatTime(durationMillis)}</Text>
      </View>
    </View>
  )
}

function ControlBtn({
  icon,
  size,
  onPress,
  primary,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  size: number
  onPress: () => void
  primary?: boolean
  disabled?: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 30 }).start()
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={12}
    >
      <Animated.View
        style={[
          primary ? styles.playBtn : styles.skipBtn,
          { transform: [{ scale }] },
          disabled && { opacity: 0.4 },
        ]}
      >
        <Ionicons name={icon} size={size} color={primary ? '#fff' : GOLD} />
      </Animated.View>
    </Pressable>
  )
}

export default function AudiobookPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const { book } = useBookDetail(id)
  const cover = book ? pickCover(book as unknown as Record<string, unknown>) : ''
  const title = book?.title ?? ''
  const rec = book as Record<string, unknown> | undefined
  const author = (rec?.authorname as string) ?? (rec?.author as string) ?? ''
  const description = (rec?.description as string) ?? (rec?.about as string) ?? ''
  const pageCount = (rec?.pages as string | number) ?? (rec?.pagecount as string | number)

  const { tracks, loading: chaptersLoading } = useBookAudioChapters(book?.id, title)

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
    next,
    previous,
  } = useAudio()

  useEffect(() => {
    if (tracks.length > 0 && !current) {
      void play(tracks[0], tracks)
    }
  }, [tracks, current, play])

  const isThisBook =
    current !== null &&
    queue.length > 0 &&
    tracks.length > 0 &&
    queue[0].url === tracks[0]?.url

  const displayIndex = isThisBook ? currentIndex : 0
  const chapterCount = isThisBook ? queue.length : tracks.length
  const currentTrack = isThisBook ? current : (tracks[0] ?? null)

  const chapterLabel =
    currentTrack?.title?.split('\u2013').pop()?.trim() ??
    currentTrack?.title ??
    `Chapter ${displayIndex + 1}`

  const onSkipBack = useCallback(
    () => void seek(Math.max(0, positionMillis - 15_000)),
    [positionMillis, seek],
  )
  const onSkipForward = useCallback(
    () => void seek(positionMillis + 15_000),
    [positionMillis, seek],
  )
  const onToggle = useCallback(() => {
    if (!isThisBook && tracks.length > 0) void play(tracks[0], tracks)
    else void toggle()
  }, [isThisBook, tracks, play, toggle])

  const onPrev = useCallback(() => {
    if (positionMillis > 3000) void seek(0)
    else void previous()
  }, [positionMillis, seek, previous])

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerIconBtn}>
          <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(id) } })}
          hitSlop={12}
          style={styles.readBtn}
        >
          <Ionicons name="book-outline" size={15} color={GOLD} />
          <Text style={styles.readBtnText}>Read</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Cover */}
        <View style={styles.coverShadow}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, styles.coverFallback]}>
              <Text style={{ fontSize: 52 }}>{'📚'}</Text>
            </View>
          )}
        </View>

        {/* Title / Author */}
        <Text style={styles.bookTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          {author ? `By ${author}` : ''}
        </Text>

        {/* Arc + Controls */}
        <View style={styles.arcWrapper}>
          <View style={styles.arc} />
          <View style={styles.controls}>
            {chaptersLoading ? (
              <ActivityIndicator color={GOLD} size="large" />
            ) : (
              <>
                <ControlBtn icon="play-back-outline" size={28} onPress={onSkipBack} />
                <ControlBtn
                  icon={isPlaying && isThisBook ? 'pause' : 'play'}
                  size={30}
                  onPress={onToggle}
                  primary
                  disabled={isLoading}
                />
                <ControlBtn icon="play-forward-outline" size={28} onPress={onSkipForward} />
              </>
            )}
          </View>
        </View>

        {/* Seek bar */}
        <SeekBar
          positionMillis={isThisBook ? positionMillis : 0}
          durationMillis={isThisBook ? durationMillis : 0}
          onSeek={seek}
        />

        {/* Lyrics / description */}
        <View style={styles.lyricsBox}>
          <Text style={styles.lyricsWatermark} numberOfLines={1}>
            {title.split(' ')[0]?.toUpperCase() ?? ''}
          </Text>
          <Text style={styles.lyricsText}>{description || chapterLabel}</Text>
        </View>
      </ScrollView>

      {/* Chapter navigation footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={onPrev}
          hitSlop={12}
          disabled={displayIndex <= 0}
          style={styles.footerArrow}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={displayIndex <= 0 ? TEXT_LIGHT : TEXT_DARK}
          />
        </Pressable>

        <View style={styles.footerCenter}>
          <Text style={styles.footerChapter}>
            Chapter {displayIndex + 1} of {chapterCount || '\u2014'}
          </Text>
          {pageCount ? (
            <Text style={styles.footerPage}>Page {pageCount}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={next}
          hitSlop={12}
          disabled={displayIndex >= chapterCount - 1}
          style={styles.footerArrow}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={displayIndex >= chapterCount - 1 ? TEXT_LIGHT : TEXT_DARK}
          />
        </Pressable>
      </View>

      <View style={styles.homeIndicator} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDEDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EDEDE8',
  },
  readBtnText: { color: GOLD, fontSize: 14, fontWeight: '600' },

  scroll: { alignItems: 'center', paddingBottom: 12 },

  coverShadow: {
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
    borderRadius: 16,
  },
  cover: { width: COVER_SIZE, height: COVER_SIZE, borderRadius: 16 },
  coverFallback: { backgroundColor: '#E8E0D0', alignItems: 'center', justifyContent: 'center' },

  bookTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 24,
  },
  bookAuthor: { marginTop: 4, fontSize: 13, color: TEXT_MID, textAlign: 'center' },

  arcWrapper: {
    width: SW,
    height: ARC_RADIUS * 0.72,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  arc: {
    position: 'absolute',
    width: ARC_RADIUS * 2,
    height: ARC_RADIUS * 2,
    borderRadius: ARC_RADIUS,
    backgroundColor: '#E8E4DC',
    bottom: -ARC_RADIUS * 0.8,
    alignSelf: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    zIndex: 2,
    marginBottom: 8,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GOLD_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  skipBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  seekContainer: { width: SW - 40, marginTop: 4 },
  trackOuter: { height: 20, justifyContent: 'center' },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: TRACK_BG,
  },
  trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: GOLD_LIGHT },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GOLD,
    top: 3,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  timeText: { fontSize: 11, color: TEXT_MID },

  lyricsBox: { width: SW - 40, marginTop: 16, minHeight: 120, overflow: 'hidden' },
  lyricsWatermark: {
    position: 'absolute',
    top: -12,
    left: -8,
    fontSize: 72,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.04)',
    letterSpacing: -2,
  },
  lyricsText: { fontSize: 13, lineHeight: 22, color: TEXT_MID, textAlign: 'justify' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDD9D0',
    backgroundColor: BG,
  },
  footerArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  footerCenter: { alignItems: 'center', flex: 1 },
  footerChapter: { fontSize: 14, fontWeight: '700', color: GOLD },
  footerPage: { fontSize: 11, color: TEXT_LIGHT, marginTop: 2 },

  homeIndicator: {
    alignSelf: 'center',
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C8C4BB',
    marginBottom: Platform.OS === 'ios' ? 8 : 4,
    marginTop: 4,
  },
})

