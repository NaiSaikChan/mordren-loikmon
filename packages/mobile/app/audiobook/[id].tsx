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
import type { AudioTrack } from '@/lib/audio'
import { pickCover } from '@/lib/url'

const GOLD = '#C9922A'
const GOLD_LIGHT = '#D4A843'
const BG = '#F9F7F2'
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
  const chapterNumber = (rec?.chapter_number as string | number) ?? (rec?.chapter as string | number) ?? ''
  const chapterTitle = (rec?.chapter_title as string) ?? (rec?.title as string) ?? ''
  const author = (rec?.authorname as string) ?? (rec?.author as string) ?? ''
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
  const playlistTracks = tracks.length > 0 ? tracks : queue

  const chapterLabel =
    currentTrack?.title?.split('\u2013').pop()?.trim() ??
    currentTrack?.title ??
    `Chapter ${displayIndex + 1}`

  const chapterDisplayTitle = currentTrack?.chapterTitle ?? (chapterTitle || chapterLabel)

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

  const onSelectChapter = useCallback(
    (track: AudioTrack) => {
      if (tracks.length === 0) return
      void play(track, tracks)
    },
    [play, tracks],
  )

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
        <View style={styles.metaCard}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {author ? `By ${author}` : ''}
          </Text>
          <Text style={styles.nowPlayingText} numberOfLines={1}>
            Now Playing: {chapterDisplayTitle}
          </Text>
        </View>

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

        {/* Chapter playlist */}
        <View style={styles.playlistBox}>
          <Text style={styles.sectionTitle}>Playlist</Text>
          {playlistTracks.length === 0 ? (
            <Text style={styles.emptyPlaylistText}>No chapters available yet.</Text>
          ) : (
            playlistTracks.map((track, idx) => {
              const active = currentTrack?.url === track.url
              const itemLabel =
                track.chapterTitle ??
                track.title?.split('\u2013').pop()?.trim() ??
                `Chapter ${idx + 1}`

              return (
                <Pressable
                  key={`${String(track.id)}-${idx}`}
                  onPress={() => onSelectChapter(track)}
                  style={[styles.playlistItem, active && styles.playlistItemActive]}
                >
                  <View style={[styles.playlistIndex, active && styles.playlistIndexActive]}>
                    <Text style={[styles.playlistIndexText, active && styles.playlistIndexTextActive]}>
                      {idx + 1}
                    </Text>
                  </View>
                  <View style={styles.playlistTextWrap}>
                    <Text
                      style={[styles.playlistTitle, active && styles.playlistTitleActive]}
                      numberOfLines={1}
                    >
                      {itemLabel}
                    </Text>
                    <Text style={styles.playlistMeta} numberOfLines={1}>
                      {active ? (isPlaying ? 'Playing' : 'Paused') : 'Tap to play'}
                    </Text>
                  </View>
                  <Ionicons
                    name={active && isPlaying ? 'pause-circle' : 'play-circle'}
                    size={26}
                    color={active ? GOLD : '#B8A88D'}
                  />
                </Pressable>
              )
            })
          )}
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
    paddingBottom: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ECE7DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ECE7DB',
  },
  readBtnText: { color: GOLD, fontSize: 14, fontWeight: '600' },

  scroll: { alignItems: 'center', paddingBottom: 20 },

  coverShadow: {
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: 20,
  },
  cover: { width: COVER_SIZE, height: COVER_SIZE, borderRadius: 20 },
  coverFallback: { backgroundColor: '#E8E0D0', alignItems: 'center', justifyContent: 'center' },

  metaCard: {
    marginTop: 18,
    width: SW - 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9E2D6',
    backgroundColor: '#FFFDF8',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },

  bookTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 24,
  },
  bookAuthor: { marginTop: 4, fontSize: 13, color: TEXT_MID, textAlign: 'center' },
  nowPlayingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#8C744A',
    fontWeight: '600',
  },

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
    marginBottom: 2,
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

  seekContainer: { width: SW - 40, marginTop: 8 },
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

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  playlistBox: {
    width: SW - 30,
    marginTop: 18,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E0D0',
    backgroundColor: '#FFFCF6',
    padding: 12,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#F7F3EA',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ECE3D4',
  },
  playlistItemActive: {
    backgroundColor: '#FDF2DD',
    borderColor: '#E9C177',
  },
  playlistIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBE4D7',
  },
  playlistIndexActive: {
    backgroundColor: GOLD,
  },
  playlistIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B795B',
  },
  playlistIndexTextActive: {
    color: '#fff',
  },
  playlistTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  playlistTitle: {
    fontSize: 13,
    color: TEXT_DARK,
    fontWeight: '600',
  },
  playlistTitleActive: {
    color: GOLD,
  },
  playlistMeta: {
    marginTop: 2,
    fontSize: 11,
    color: TEXT_MID,
  },
  emptyPlaylistText: {
    fontSize: 12,
    color: TEXT_MID,
    paddingVertical: 8,
  },

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

