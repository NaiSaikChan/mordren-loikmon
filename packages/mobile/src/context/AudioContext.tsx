import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { LOCK_SCREEN_ART_WIDTH, trackImage, type AudioTrack } from '@/lib/audio'
import { useAuth } from '@/context/AuthContext'
import { storage } from '@/services/storage'
import { isExpired, refreshTrackUrl } from '@/lib/refreshTrack'
import {
  TIMED_OUT,
  bookIdOf,
  createProgressReporter,
  loadAudioPosition,
  planResume,
  withTimeout,
  type ProgressReporter,
} from '@/lib/playbackProgress'

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

/** Native status cadence. Twice a second is plenty for a time label and a progress bar. */
export const STATUS_UPDATE_INTERVAL_MS = 500

/**
 * Longest a slow progress lookup may hold back the start of playback. Past it the
 * chapter starts from the top and the stored position is applied when it arrives.
 */
export const RESUME_WAIT_MS = 1200

/** Re-sign-and-reload attempts per track before giving up with an error. */
export const MAX_RECOVERY_ATTEMPTS = 2

/** Buffering this long on a URL past its expiry is treated as a dead signature. */
export const STALL_RECOVERY_MS = 12_000

/** Playing this long without trouble after a recovery earns the track a fresh set of attempts. */
const RECOVERY_RESET_MS = 30_000

const RATE_STORAGE_KEY = 'audio_rate'

/**
 * Everything that changes only on real state changes: what is loaded, whether it
 * plays, preferences, and the (stable) commands. Most screens only need this.
 */
export interface AudioControlsValue {
  current: AudioTrack | null
  queue: AudioTrack[]
  currentIndex: number
  isPlaying: boolean
  /** Loading a track, or buffering one that is loaded. */
  isLoading: boolean
  /** The loaded track is waiting on the network. */
  isBuffering: boolean
  /** Set when playback could not start or continue; cleared on the next successful play. */
  error: AudioError | null
  /** Set when access was lost mid-session: the screen sends the listener to sign in or subscribe. */
  lockedAction: 'login' | 'subscribe' | null
  rate: number
  sleepMode: SleepMode
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
  /** Position right now, read from the player without subscribing to progress updates. */
  getPositionMillis: () => number
}

/** Values that tick while playing. Subscribe only where they are drawn. */
export interface AudioProgressValue {
  positionMillis: number
  durationMillis: number
  /** Milliseconds left on a timed sleep timer; null when off or waiting for the chapter to end. */
  sleepRemainingMs: number | null
}

export type AudioContextValue = AudioControlsValue & AudioProgressValue

const AudioControlsContext = createContext<AudioControlsValue | undefined>(undefined)
const AudioProgressContext = createContext<AudioProgressValue | undefined>(undefined)

function sameTrack(a: AudioTrack | null | undefined, b: AudioTrack | null | undefined): boolean {
  return Boolean(a && b && String(a.id) === String(b.id))
}

/** A seek owed to one particular load; dropped as soon as another track is loaded. */
interface PendingSeek {
  loadId: number
  seconds?: number
  percent?: number
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: STATUS_UPDATE_INTERVAL_MS })
  const status = useAudioPlayerStatus(player)
  const { isLoggedIn } = useAuth()

  const currentTrackRef = useRef<AudioTrack | null>(null)
  const queueRef = useRef<AudioTrack[]>([])
  const indexRef = useRef<number>(-1)
  const [current, setCurrent] = useState<AudioTrack | null>(null)
  const [queue, setQueue] = useState<AudioTrack[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  /** Between choosing a track and handing its URL to the player. */
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<AudioError | null>(null)
  const [lockedAction, setLockedAction] = useState<'login' | 'subscribe' | null>(null)
  const [rate, setRateState] = useState(1)
  const [sleepMode, setSleepMode] = useState<SleepMode>('off')
  const [sleepRemainingMs, setSleepRemainingMs] = useState<number | null>(null)

  const rateRef = useRef(1)
  const sleepModeRef = useRef<SleepMode>('off')
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isLoggedInRef = useRef(isLoggedIn)
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn
  }, [isLoggedIn])

  const progressRef = useRef<ProgressReporter | null>(null)
  const reporter = useCallback((): ProgressReporter => {
    progressRef.current ??= createProgressReporter(() => isLoggedInRef.current)
    return progressRef.current
  }, [])

  /**
   * Every load gets a fresh id. Anything async (URL re-signing, the progress
   * lookup) re-checks it after each await, so a slow older request can never
   * `replace()` over a chapter the listener picked after it.
   */
  const loadIdRef = useRef(0)
  /** Id of the load whose URL was last handed to the player. */
  const replacedRef = useRef(-1)
  /** Books already resumed this session, so a position is restored once and not re-applied on every replay. */
  const resumedBooksRef = useRef(new Set<string>())
  const pendingSeekRef = useRef<PendingSeek | null>(null)
  /** Load whose resume seek has been sent but not confirmed; the stale position must not be reported. */
  const seekLandingRef = useRef<number | null>(null)
  /** Load whose stored position is still being fetched; progress reporting waits for it. */
  const resumeHoldRef = useRef<number | null>(null)
  /** Whether the listener wants sound (as opposed to the player's momentary state). */
  const wantPlayingRef = useRef(false)
  const lastPositionRef = useRef<{ loadId: number; seconds: number } | null>(null)
  const recoveryRef = useRef<{ loadId: number; count: number; at: number; busy: boolean }>({
    loadId: -1,
    count: 0,
    at: 0,
    busy: false,
  })

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

  /** Starts a new load, invalidating every in-flight one and anything owed to it. */
  const beginLoad = useCallback((): number => {
    loadIdRef.current += 1
    pendingSeekRef.current = null
    seekLandingRef.current = null
    resumeHoldRef.current = null
    lastPositionRef.current = null
    return loadIdRef.current
  }, [])

  const publishMeta = useCallback(() => {
    setCurrent(currentTrackRef.current)
    setQueue(queueRef.current)
    setCurrentIndex(Math.max(0, indexRef.current))
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
            // A ~300pt WebP rendition, not the full-size original cover.
            artworkUrl: trackImage(track, LOCK_SCREEN_ART_WIDTH) || undefined,
          },
          { showSeekForward: true, showSeekBackward: true },
        )
      } catch {
        /* Lock screen controls are a bonus, never a requirement for playback. */
      }
    },
    [player],
  )

  /** Lands a pending seek as soon as the player can take it. Safe to call at any time. */
  const applyPendingSeek = useCallback(() => {
    const pending = pendingSeekRef.current
    if (!pending) return
    if (pending.loadId !== loadIdRef.current) {
      pendingSeekRef.current = null
      return
    }
    if (replacedRef.current !== pending.loadId || !player.isLoaded) return
    const reported = player.duration > 0 ? player.duration : 0
    const duration = reported || currentTrackRef.current?.durationSeconds || 0
    let seconds = pending.seconds ?? null
    if (seconds === null) {
      if (!(duration > 0) || pending.percent == null) return
      seconds = (pending.percent / 100) * duration
    }
    pendingSeekRef.current = null
    const { loadId } = pending
    seekLandingRef.current = loadId
    player
      .seekTo(reported > 0 ? Math.min(seconds, reported) : seconds)
      .catch(() => undefined)
      .finally(() => {
        if (seekLandingRef.current === loadId) seekLandingRef.current = null
      })
  }, [player])

  /** Hands a URL to the player and starts it. */
  const startTrack = useCallback(
    (id: number, candidate: AudioTrack) => {
      // expo-audio's replace() is synchronous; load failures arrive later as `status.error`.
      player.replace(candidate.url)
      replacedRef.current = id
      // Without pitch correction a sped-up narrator sounds comical.
      if (rateRef.current !== 1) player.setPlaybackRate(rateRef.current, 'high')
      if (wantPlayingRef.current) player.play()
      currentTrackRef.current = candidate
      queueRef.current = queueRef.current.map((item) => (sameTrack(item, candidate) ? candidate : item))
      setCurrent(candidate)
      setQueue(queueRef.current)
      setSwitching(false)
      applyLockScreen(candidate)
      // A pending seek lands from the status effect, once the new source reports in.
    },
    [player, applyLockScreen],
  )

  /**
   * Loads a track and starts it.
   *
   * A signed URL that has expired (or fails on load) is re-requested before
   * giving up, because an audiobook sitting routinely outlives one.
   */
  const loadAndPlay = useCallback(
    async (id: number, track: AudioTrack, index: number, seek: Omit<PendingSeek, 'loadId'> | null = null) => {
      if (id !== loadIdRef.current) return
      indexRef.current = index
      currentTrackRef.current = track
      wantPlayingRef.current = true
      pendingSeekRef.current = seek ? { loadId: id, ...seek } : null
      publishMeta()
      setSwitching(true)
      setError(null)
      setLockedAction(null)

      let playable = track
      if (isExpired(track.expiresAt)) {
        const refreshed = await refreshTrackUrl(track, isLoggedInRef.current)
        if (id !== loadIdRef.current) return
        if (refreshed?.kind === 'locked') {
          setLockedAction(refreshed.action)
          setSwitching(false)
          return
        }
        if (refreshed?.kind === 'url') {
          playable = { ...track, url: refreshed.url, expiresAt: refreshed.expiresAt }
        }
      }

      try {
        startTrack(id, playable)
        return
      } catch {
        /* Fall through: most load failures here are an expired signature. */
      }

      const refreshed = await refreshTrackUrl(playable, isLoggedInRef.current)
      if (id !== loadIdRef.current) return
      if (refreshed?.kind === 'locked') {
        setLockedAction(refreshed.action)
        setSwitching(false)
        return
      }
      if (!refreshed) {
        setError('unavailable')
        setSwitching(false)
        return
      }
      try {
        startTrack(id, { ...playable, url: refreshed.url, expiresAt: refreshed.expiresAt })
      } catch {
        setError('playback_failed')
        setSwitching(false)
      }
    },
    [publishMeta, startTrack],
  )

  const playAtIndex = useCallback(
    async (index: number) => {
      const track = queueRef.current[index]
      if (!track) return
      await loadAndPlay(beginLoad(), track, index)
    },
    [beginLoad, loadAndPlay],
  )

  /**
   * Starts a track, dropping the listener back where they stopped (once per book
   * per session, see `planResume`).
   *
   * The stored position is looked up *before* the track loads, so the seek is
   * owed to that load and lands the moment the player is ready. The lookup may
   * delay the start by at most `RESUME_WAIT_MS`; after that the chapter starts
   * and the position is applied when it arrives. Reporting is held back until
   * then, or a 0% report would overwrite the real stored position.
   */
  const play = useCallback(
    async (track: AudioTrack, autoQueue?: AudioTrack[]) => {
      const id = beginLoad()
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

      const bookId = bookIdOf(track)
      if (!bookId || resumedBooksRef.current.has(bookId)) {
        await loadAndPlay(id, track, index)
        return
      }
      resumedBooksRef.current.add(bookId)
      resumeHoldRef.current = id

      // Show the chosen chapter (and silence the old one) while the lookup runs.
      if (player.playing) player.pause()
      currentTrackRef.current = track
      publishMeta()
      setSwitching(true)
      setError(null)
      setLockedAction(null)

      const lookup = loadAudioPosition(bookId, isLoggedInRef.current).catch(() => null)
      const early = await withTimeout(lookup, RESUME_WAIT_MS)
      if (id !== loadIdRef.current) return

      if (early !== TIMED_OUT) {
        resumeHoldRef.current = null
        const plan = planResume(track, index, queueRef.current, early)
        if (plan?.kind === 'jump') {
          await loadAndPlay(id, queueRef.current[plan.index], plan.index, { percent: plan.percent })
        } else {
          await loadAndPlay(id, track, index, plan ? { percent: plan.percent } : null)
        }
        return
      }

      // Slow network: progress never blocks playback.
      await loadAndPlay(id, track, index)
      const late = await lookup
      if (id !== loadIdRef.current || resumeHoldRef.current !== id) return
      resumeHoldRef.current = null
      const plan = planResume(track, index, queueRef.current, late)
      if (!plan) return
      if (plan.kind === 'jump') {
        await loadAndPlay(beginLoad(), queueRef.current[plan.index], plan.index, { percent: plan.percent })
        return
      }
      pendingSeekRef.current = { loadId: id, percent: plan.percent }
      applyPendingSeek()
    },
    [player, beginLoad, loadAndPlay, publishMeta, applyPendingSeek],
  )

  const toggle = useCallback(async () => {
    if (!currentTrackRef.current) return
    if (player.playing) {
      wantPlayingRef.current = false
      player.pause()
      void reporter().flush()
    } else {
      wantPlayingRef.current = true
      player.play()
    }
  }, [player, reporter])

  /**
   * Records a position the listener moved to by hand. While paused nothing else
   * would store it, so it is written straight away. A manual move also cancels
   * a resume still in flight: the listener's choice wins.
   */
  const recordManualPosition = useCallback(
    (seconds: number) => {
      const id = loadIdRef.current
      const track = currentTrackRef.current
      if (resumeHoldRef.current === id) resumeHoldRef.current = null
      if (pendingSeekRef.current?.loadId === id) pendingSeekRef.current = null
      if (!track || replacedRef.current !== id) return
      const duration = player.duration > 0 ? player.duration : track.durationSeconds || 0
      if (!(duration > 0)) return
      lastPositionRef.current = { loadId: id, seconds }
      reporter().report(track, (seconds / duration) * 100)
      if (!player.playing) void reporter().flush()
    },
    [player, reporter],
  )

  const seek = useCallback(
    async (millis: number) => {
      if (!currentTrackRef.current) return
      const seconds = Math.max(0, millis / 1000)
      const duration = player.duration || 0
      const target = duration > 0 ? Math.min(seconds, duration) : seconds
      recordManualPosition(target)
      await player.seekTo(target)
    },
    [player, recordManualPosition],
  )

  const skip = useCallback(
    async (millis: number) => {
      if (!currentTrackRef.current) return
      const duration = player.duration || 0
      const target = (player.currentTime || 0) + millis / 1000
      const clamped = Math.max(0, duration > 0 ? Math.min(target, duration) : target)
      recordManualPosition(clamped)
      await player.seekTo(clamped)
    },
    [player, recordManualPosition],
  )

  const stopSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    sleepTimerRef.current = null
    setSleepRemainingMs(null)
  }, [])

  const stop = useCallback(async () => {
    beginLoad()
    wantPlayingRef.current = false
    // Record where they stopped before the track is torn down.
    await reporter().flush()
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
    setCurrent(null)
    setQueue([])
    setCurrentIndex(0)
    setSwitching(false)
    setError(null)
    setLockedAction(null)
    setSleepMode('off')
    sleepModeRef.current = 'off'
    stopSleepTimer()
  }, [player, reporter, beginLoad, stopSleepTimer])

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
        wantPlayingRef.current = false
        if (player.playing) player.pause()
        void reporter().flush()
        setSleepMode('off')
        sleepModeRef.current = 'off'
        stopSleepTimer()
      }, 1000)
    },
    [player, reporter, stopSleepTimer],
  )

  useEffect(() => () => stopSleepTimer(), [stopSleepTimer])

  const retry = useCallback(async () => {
    const track = currentTrackRef.current
    if (!track) return
    const last = lastPositionRef.current
    const resumeAt = last && last.loadId === loadIdRef.current ? last.seconds : null
    await loadAndPlay(beginLoad(), track, indexRef.current, resumeAt ? { seconds: resumeAt } : null)
  }, [beginLoad, loadAndPlay])

  const dismissError = useCallback(() => {
    setError(null)
    setLockedAction(null)
  }, [])

  const getPositionMillis = useCallback(() => {
    if (!currentTrackRef.current) return 0
    return Math.max(0, Math.floor((player.currentTime || 0) * 1000))
  }, [player])

  /**
   * Mid-stream recovery: a signed URL that expires while a chapter plays shows
   * up as a player error (or an endless stall). Re-sign it, reload, and put the
   * listener back where they were — a bounded number of times per track.
   */
  const recover = useCallback(async () => {
    const id = loadIdRef.current
    const track = currentTrackRef.current
    const state = recoveryRef.current
    if (!track || replacedRef.current !== id) return
    if (state.loadId === id && state.busy) return
    const attempts = state.loadId === id ? state.count : 0
    if (attempts >= MAX_RECOVERY_ATTEMPTS) {
      await Promise.resolve()
      if (id === loadIdRef.current) setError('playback_failed')
      return
    }
    recoveryRef.current = { loadId: id, count: attempts + 1, at: Date.now(), busy: true }
    const last = lastPositionRef.current
    const resumeAt = last && last.loadId === id ? last.seconds : null
    try {
      const refreshed = await refreshTrackUrl(track, isLoggedInRef.current)
      if (id !== loadIdRef.current) return
      if (refreshed?.kind === 'locked') {
        wantPlayingRef.current = false
        setLockedAction(refreshed.action)
        return
      }
      if (!refreshed) {
        setError('unavailable')
        return
      }
      if (resumeAt && resumeAt > 0) pendingSeekRef.current = { loadId: id, seconds: resumeAt }
      startTrack(id, { ...track, url: refreshed.url, expiresAt: refreshed.expiresAt })
    } catch {
      if (id === loadIdRef.current) setError('playback_failed')
    } finally {
      if (recoveryRef.current.loadId === id) recoveryRef.current.busy = false
    }
  }, [startTrack])

  useEffect(() => {
    if (!status.error || !currentTrackRef.current) return
    void recover()
  }, [status.error, recover])

  // A stall on an expired signature never turns into an error on some platforms.
  useEffect(() => {
    if (!status.isBuffering || !current) return
    const timer = setTimeout(() => {
      const track = currentTrackRef.current
      if (!track || !wantPlayingRef.current || !player.isBuffering) return
      if (!isExpired(track.expiresAt)) return
      void recover()
    }, STALL_RECOVERY_MS)
    return () => clearTimeout(timer)
  }, [status.isBuffering, current, player, recover])

  // Land pending seeks, remember the last good position, and forgive old recoveries.
  useEffect(() => {
    const id = loadIdRef.current
    if (!currentTrackRef.current || replacedRef.current !== id) return
    applyPendingSeek()
    const settled = !pendingSeekRef.current && seekLandingRef.current !== id
    if (status.isLoaded && status.currentTime > 0 && settled && !status.error) {
      lastPositionRef.current = { loadId: id, seconds: status.currentTime }
    }
    const rec = recoveryRef.current
    if (status.playing && rec.loadId === id && rec.count > 0 && !rec.busy && Date.now() - rec.at > RECOVERY_RESET_MS) {
      recoveryRef.current = { ...rec, count: 0 }
    }
  }, [status, applyPendingSeek])

  // Record the position as the chapter plays. Held back until the track is on the
  // player and any resume has landed, or we would store 0% over the real position.
  useEffect(() => {
    const id = loadIdRef.current
    const track = currentTrackRef.current
    if (!track || !status.playing) return
    if (replacedRef.current !== id || resumeHoldRef.current === id) return
    if (pendingSeekRef.current || seekLandingRef.current === id) return
    if (!(status.duration > 0)) return
    reporter().report(track, (status.currentTime / status.duration) * 100)
  }, [status.playing, status.currentTime, status.duration, reporter])

  // Auto-advance when the chapter finishes.
  useEffect(() => {
    if (!status.didJustFinish) return
    reporter().report(currentTrackRef.current, 100)
    void reporter().flush()
    if (sleepModeRef.current === 'end-of-chapter') {
      wantPlayingRef.current = false
      setSleepMode('off')
      sleepModeRef.current = 'off'
      return
    }
    void next()
  }, [status.didJustFinish, next, reporter])

  // Backgrounding the app is the last reliable chance to store the position;
  // returning to it retries a save that failed while offline.
  useEffect(() => {
    const sub = AppState.addEventListener('change', () => {
      void reporter().flush()
    })
    return () => sub.remove()
  }, [reporter])

  // Signing out invalidates both the pending position and the session's resume state.
  useEffect(() => {
    if (isLoggedIn) return
    reporter().reset()
    resumedBooksRef.current.clear()
  }, [isLoggedIn, reporter])

  const hasTrack = current !== null
  const settled = hasTrack && !switching
  const isPlaying = settled && status.playing
  const isBuffering = settled && status.isBuffering
  const isLoading = hasTrack && !error && !lockedAction && (switching || !status.isLoaded || status.isBuffering)
  const positionMillis = settled ? Math.max(0, Math.floor(status.currentTime * 1000)) : 0
  const durationMillis = settled ? Math.max(0, Math.floor(status.duration * 1000)) : 0

  const controls = useMemo<AudioControlsValue>(
    () => ({
      current,
      queue,
      currentIndex,
      isPlaying,
      isLoading,
      isBuffering,
      error,
      lockedAction,
      rate,
      sleepMode,
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
      getPositionMillis,
    }),
    [
      current,
      queue,
      currentIndex,
      isPlaying,
      isLoading,
      isBuffering,
      error,
      lockedAction,
      rate,
      sleepMode,
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
      getPositionMillis,
    ],
  )

  const progress = useMemo<AudioProgressValue>(
    () => ({ positionMillis, durationMillis, sleepRemainingMs }),
    [positionMillis, durationMillis, sleepRemainingMs],
  )

  return (
    <AudioControlsContext.Provider value={controls}>
      <AudioProgressContext.Provider value={progress}>{children}</AudioProgressContext.Provider>
    </AudioControlsContext.Provider>
  )
}

/** Track, transport state and commands. Does not re-render as the position ticks. */
export function useAudioControls(): AudioControlsValue {
  const ctx = useContext(AudioControlsContext)
  if (!ctx) throw new Error('useAudioControls must be used within an AudioProvider')
  return ctx
}

/** Position, duration and sleep countdown. Re-renders twice a second while playing. */
export function useAudioProgress(): AudioProgressValue {
  const ctx = useContext(AudioProgressContext)
  if (!ctx) throw new Error('useAudioProgress must be used within an AudioProvider')
  return ctx
}

/**
 * Both halves merged, for existing callers. Prefer `useAudioControls` wherever
 * the position is not drawn: this re-renders on every progress tick.
 */
export function useAudio(): AudioContextValue {
  const controls = useContext(AudioControlsContext)
  const progress = useContext(AudioProgressContext)
  const merged = useMemo(
    () => (controls && progress ? { ...controls, ...progress } : null),
    [controls, progress],
  )
  if (!merged) throw new Error('useAudio must be used within an AudioProvider')
  return merged
}
