import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import type { AudioTrack } from '@/lib/audio'
import { useAuth } from '@/context/AuthContext'
import { storage } from '@/services/storage'
import { isExpired, refreshTrackUrl } from '@/lib/refreshTrack'
import { createProgressReporter, loadAudioPosition } from '@/lib/playbackProgress'

export type { AudioTrack }

/** Why playback stopped. Screens map these to translated copy. */
export type AudioError = 'playback_failed' | 'unavailable'

/** How far the skip controls jump. 15s is the audiobook convention: one lost sentence. */
export const SKIP_MILLIS = 15_000

/** Narration stays intelligible across this range; anything faster is novelty. */
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const

/** Sleep timer choices, in minutes, alongside the two non-numeric modes. */
export const SLEEP_MINUTES = [5, 15, 30, 45, 60] as const

export type SleepMode = 'off' | 'end-of-chapter' | number

const RATE_STORAGE_KEY = 'audio_rate'

interface AudioContextValue {
  current: AudioTrack | null
  queue: AudioTrack[]
  currentIndex: number
  isPlaying: boolean
  isLoading: boolean
  positionMillis: number
  durationMillis: number
  /** Set when playback could not start or continue; cleared on the next successful play. */
  error: AudioError | null
  /** Set when access was lost mid-session: the screen sends the listener to sign in or subscribe. */
  lockedAction: 'login' | 'subscribe' | null
  rate: number
  sleepMode: SleepMode
  /** Milliseconds left on a timed sleep timer; null when off or waiting for the chapter to end. */
  sleepRemainingMs: number | null
  play: (track: AudioTrack, queue?: AudioTrack[]) => Promise<void>
  toggle: () => Promise<void>
  seek: (millis: number) => Promise<void>
  stop: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  /** Jumps by a signed number of milliseconds, clamped to the chapter. */
  skip: (millis: number) => Promise<void>
  setRate: (value: number) => void
  setSleep: (mode: SleepMode) => void
  /** Retries the current track, re-signing its URL first. */
  retry: () => Promise<void>
  dismissError: () => void
}

const AudioContext = createContext<AudioContextValue | undefined>(undefined)

function sameTrack(a: AudioTrack | null | undefined, b: AudioTrack | null | undefined): boolean {
  return Boolean(a && b && String(a.id) === String(b.id))
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 250 })
  const status = useAudioPlayerStatus(player)
  const { isLoggedIn } = useAuth()

  const currentTrackRef = useRef<AudioTrack | null>(null)
  const queueRef = useRef<AudioTrack[]>([])
  const indexRef = useRef<number>(-1)
  const [current, setCurrent] = useState<AudioTrack | null>(null)
  const [queue, setQueue] = useState<AudioTrack[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [positionMillis, setPositionMillis] = useState(0)
  const [durationMillis, setDurationMillis] = useState(0)
  const [error, setError] = useState<AudioError | null>(null)
  const [lockedAction, setLockedAction] = useState<'login' | 'subscribe' | null>(null)
  const [rate, setRateState] = useState(1)
  const [sleepMode, setSleepMode] = useState<SleepMode>('off')
  const [sleepRemainingMs, setSleepRemainingMs] = useState<number | null>(null)

  const rateRef = useRef(1)
  const sleepModeRef = useRef<SleepMode>('off')
  sleepModeRef.current = sleepMode
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isLoggedInRef = useRef(isLoggedIn)
  isLoggedInRef.current = isLoggedIn

  const progressRef = useRef(createProgressReporter(() => isLoggedInRef.current))
  /** Books already resumed this session, so a position is restored once and not re-applied on every replay. */
  const resumedBooksRef = useRef(new Set<string>())
  /** Seconds to seek to as soon as the pending track reports a duration. */
  const pendingSeekRef = useRef<number | null>(null)

  // Playback speed is a listener preference, not a per-book setting.
  useEffect(() => {
    void storage.get(RATE_STORAGE_KEY).then((raw) => {
      const value = Number(raw)
      if (PLAYBACK_RATES.includes(value as (typeof PLAYBACK_RATES)[number])) {
        rateRef.current = value
        setRateState(value)
      }
    })
  }, [])

  useEffect(() => {
    // `doNotMix` is what lets the OS attach the lock screen / notification
    // controls to this player; without it background audio still plays but the
    // controls never appear.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!currentTrackRef.current) return
    setIsPlaying(status.playing)
    setPositionMillis(Math.max(0, Math.floor(status.currentTime * 1000)))
    setDurationMillis(Math.max(0, Math.floor(status.duration * 1000)))
    setIsLoading(!status.isLoaded || status.isBuffering)
  }, [status])

  const syncMeta = useCallback(() => {
    const track = currentTrackRef.current
    setCurrent(track)
    setQueue(queueRef.current)
    setCurrentIndex(indexRef.current)
    setIsPlaying(false)
    setPositionMillis(0)
    setDurationMillis(0)
    setIsLoading(!!track)
  }, [])

  const applyLockScreen = useCallback(
    (track: AudioTrack) => {
      try {
        player.setActiveForLockScreen(
          true,
          {
            title: track.chapterTitle || track.title,
            artist: track.artist || undefined,
            albumTitle: track.title,
            artworkUrl: track.cover || undefined,
          },
          { showSeekForward: true, showSeekBackward: true },
        )
      } catch {
        /* Lock screen controls are a bonus, never a requirement for playback. */
      }
    },
    [player],
  )

  /**
   * Loads a track and starts it.
   *
   * A signed URL that has expired (or fails on load) is re-requested before
   * giving up, because an audiobook sitting routinely outlives one.
   */
  const loadAndPlay = useCallback(
    async (track: AudioTrack, index: number, seekToSeconds: number | null = null) => {
      indexRef.current = index
      currentTrackRef.current = track
      syncMeta()
      setIsLoading(true)
      setError(null)
      setLockedAction(null)
      pendingSeekRef.current = seekToSeconds

      let playable = track
      if (isExpired(track.expiresAt)) {
        const refreshed = await refreshTrackUrl(track, isLoggedInRef.current)
        if (refreshed?.kind === 'locked') {
          setLockedAction(refreshed.action)
          setIsLoading(false)
          return
        }
        if (refreshed?.kind === 'url') {
          playable = { ...track, url: refreshed.url, expiresAt: refreshed.expiresAt }
        }
      }

      const start = async (candidate: AudioTrack) => {
        await player.replace(candidate.url)
        // Without pitch correction a sped-up narrator sounds comical.
        if (rateRef.current !== 1) player.setPlaybackRate(rateRef.current, 'high')
        player.play()
        currentTrackRef.current = candidate
        queueRef.current = queueRef.current.map((item) => (sameTrack(item, candidate) ? candidate : item))
        setCurrent(candidate)
        setQueue(queueRef.current)
        applyLockScreen(candidate)
      }

      try {
        await start(playable)
        return
      } catch {
        /* Fall through: most load failures here are an expired signature. */
      }

      const refreshed = await refreshTrackUrl(playable, isLoggedInRef.current)
      if (refreshed?.kind === 'locked') {
        setLockedAction(refreshed.action)
        setIsLoading(false)
        return
      }
      if (!refreshed) {
        setError('unavailable')
        setIsLoading(false)
        return
      }
      try {
        await start({ ...playable, url: refreshed.url, expiresAt: refreshed.expiresAt })
      } catch {
        setError('playback_failed')
        setIsLoading(false)
      }
    },
    [player, syncMeta, applyLockScreen],
  )

  const playAtIndex = useCallback(
    async (index: number) => {
      const track = queueRef.current[index]
      if (!track) return
      await loadAndPlay(track, index)
    },
    [loadAndPlay],
  )

  /**
   * Drops the listener back where they stopped, once per book per session.
   *
   * Starting at the head of a multi-chapter queue means "carry on with this book",
   * so playback moves to the stored chapter. Starting anywhere else is a deliberate
   * choice of chapter, and only the position inside that chapter is restored.
   */
  const resumeIfStored = useCallback(
    async (track: AudioTrack, index: number): Promise<boolean> => {
      if (track.sourceType !== 'book' || track.sourceBookId == null) return false
      const bookId = String(track.sourceBookId)
      if (resumedBooksRef.current.has(bookId)) return false
      resumedBooksRef.current.add(bookId)

      const position = await loadAudioPosition(bookId, isLoggedInRef.current)
      if (!position) return false
      // The listener may have moved on while the position was in flight.
      if (!sameTrack(currentTrackRef.current, track)) return false

      const chapterSeconds = (seconds: number | null | undefined, percent: number) =>
        seconds && seconds > 0 ? (percent / 100) * seconds : null

      if (String(track.chapterId ?? '') === position.chapterId) {
        pendingSeekRef.current = chapterSeconds(track.durationSeconds, position.percent)
        return false
      }
      if (index !== 0 || queueRef.current.length < 2) return false
      const storedIndex = queueRef.current.findIndex((item) => String(item.chapterId ?? '') === position.chapterId)
      if (storedIndex < 0) return false
      const stored = queueRef.current[storedIndex]
      await loadAndPlay(stored, storedIndex, chapterSeconds(stored.durationSeconds, position.percent))
      return true
    },
    [loadAndPlay],
  )

  const play = useCallback(
    async (track: AudioTrack, autoQueue?: AudioTrack[]) => {
      queueRef.current = autoQueue ?? []
      // Match on id: signed URLs are regenerated on every fetch, so they are not an identity.
      const idx = queueRef.current.findIndex((t) => sameTrack(t, track))
      if (idx < 0) {
        queueRef.current = [track]
        indexRef.current = 0
      } else {
        indexRef.current = idx
      }
      const index = indexRef.current
      await loadAndPlay(track, index)
      void resumeIfStored(track, index)
    },
    [loadAndPlay, resumeIfStored],
  )

  const toggle = useCallback(async () => {
    if (!currentTrackRef.current) return
    if (player.playing) {
      player.pause()
      void progressRef.current.flush()
    } else {
      player.play()
    }
  }, [player])

  const seek = useCallback(
    async (millis: number) => {
      if (!currentTrackRef.current) return
      const seconds = Math.max(0, millis / 1000)
      const duration = player.duration || 0
      await player.seekTo(duration > 0 ? Math.min(seconds, duration) : seconds)
    },
    [player],
  )

  const stop = useCallback(async () => {
    // Record where they stopped before the track is torn down.
    await progressRef.current.flush()
    try {
      player.pause()
      player.clearLockScreenControls()
      player.replace(null)
    } catch {
      // Even if the native player errors, still clear app-level playback state.
    }
    currentTrackRef.current = null
    queueRef.current = []
    indexRef.current = -1
    pendingSeekRef.current = null
    setCurrent(null)
    setQueue([])
    setCurrentIndex(0)
    setIsPlaying(false)
    setIsLoading(false)
    setPositionMillis(0)
    setDurationMillis(0)
    setError(null)
    setLockedAction(null)
    setSleepMode('off')
    sleepModeRef.current = 'off'
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    sleepTimerRef.current = null
    setSleepRemainingMs(null)
  }, [player])

  const next = useCallback(async () => {
    if (queueRef.current.length === 0) return
    const nextIndex = indexRef.current + 1
    if (nextIndex < queueRef.current.length) {
      await playAtIndex(nextIndex)
    }
  }, [playAtIndex])

  const previous = useCallback(async () => {
    if (queueRef.current.length === 0) return
    const prevIndex = indexRef.current - 1
    if (prevIndex >= 0) {
      await playAtIndex(prevIndex)
    }
  }, [playAtIndex])

  const skip = useCallback(
    async (millis: number) => {
      if (!currentTrackRef.current) return
      const duration = player.duration || 0
      const target = (player.currentTime || 0) + millis / 1000
      await player.seekTo(Math.max(0, duration > 0 ? Math.min(target, duration) : target))
    },
    [player],
  )

  const setRate = useCallback(
    (value: number) => {
      rateRef.current = value
      setRateState(value)
      try {
        player.setPlaybackRate(value, 'high')
      } catch {
        /* Rate is a preference; a native rejection must not break playback. */
      }
      void storage.set(RATE_STORAGE_KEY, String(value)).catch(() => undefined)
    },
    [player],
  )

  const stopSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    sleepTimerRef.current = null
    setSleepRemainingMs(null)
  }, [])

  const setSleep = useCallback(
    (mode: SleepMode) => {
      setSleepMode(mode)
      sleepModeRef.current = mode
      stopSleepTimer()
      if (typeof mode !== 'number') return
      const endsAt = Date.now() + mode * 60_000
      setSleepRemainingMs(endsAt - Date.now())
      sleepTimerRef.current = setInterval(() => {
        const left = endsAt - Date.now()
        setSleepRemainingMs(Math.max(0, left))
        if (left > 0) return
        if (player.playing) player.pause()
        void progressRef.current.flush()
        setSleepMode('off')
        sleepModeRef.current = 'off'
        stopSleepTimer()
      }, 1000)
    },
    [player, stopSleepTimer],
  )

  useEffect(() => () => stopSleepTimer(), [stopSleepTimer])

  const retry = useCallback(async () => {
    const track = currentTrackRef.current
    if (!track) return
    await loadAndPlay(track, indexRef.current)
  }, [loadAndPlay])

  const dismissError = useCallback(() => {
    setError(null)
    setLockedAction(null)
  }, [])

  // Apply a pending resume once the track reports how long it is.
  useEffect(() => {
    const seconds = pendingSeekRef.current
    if (seconds === null || !status.isLoaded || !(status.duration > 0)) return
    pendingSeekRef.current = null
    player.seekTo(Math.min(seconds, status.duration)).catch(() => undefined)
  }, [status.isLoaded, status.duration, player])

  // Record the position as the chapter plays. Held back until a pending resume
  // has landed, or we would store 0% over the real position.
  useEffect(() => {
    if (!currentTrackRef.current || !status.playing) return
    if (pendingSeekRef.current !== null) return
    if (!(status.duration > 0)) return
    progressRef.current.report(currentTrackRef.current, (status.currentTime / status.duration) * 100)
  }, [status.playing, status.currentTime, status.duration])

  // Auto-advance when the chapter finishes.
  useEffect(() => {
    if (!status.didJustFinish) return
    progressRef.current.report(currentTrackRef.current, 100)
    void progressRef.current.flush()
    if (sleepModeRef.current === 'end-of-chapter') {
      setSleepMode('off')
      sleepModeRef.current = 'off'
      return
    }
    void next()
  }, [status.didJustFinish, next])

  // Backgrounding the app is the last reliable chance to store the position.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void progressRef.current.flush()
    })
    return () => sub.remove()
  }, [])

  // Signing out invalidates both the pending position and the session's resume state.
  useEffect(() => {
    if (isLoggedIn) return
    progressRef.current.reset()
    resumedBooksRef.current.clear()
  }, [isLoggedIn])

  const value = useMemo<AudioContextValue>(
    () => ({
      current,
      queue,
      currentIndex,
      isPlaying,
      isLoading,
      positionMillis,
      durationMillis,
      error,
      lockedAction,
      rate,
      sleepMode,
      sleepRemainingMs,
      play,
      toggle,
      seek,
      stop,
      next,
      previous,
      skip,
      setRate,
      setSleep,
      retry,
      dismissError,
    }),
    [current, queue, currentIndex, isPlaying, isLoading, positionMillis, durationMillis, error, lockedAction, rate, sleepMode, sleepRemainingMs, play, toggle, seek, stop, next, previous, skip, setRate, setSleep, retry, dismissError],
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider')
  return ctx
}
