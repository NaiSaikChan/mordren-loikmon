import { ref, computed, onMounted, onUnmounted, watch, type Ref, type ComputedRef } from 'vue'
import type { AudioTrack } from '@/stores/bookAudio'
import { usePaywallStore } from '@/stores/paywall'
import { useAuthStore } from '@/stores/auth'
import { refreshTrackUrl, type PlayAudioDetail } from '@/composables/audioPlayback'
import { bookIdOf, chapterIdOf, createProgressReporter, loadAudioPosition } from '@/composables/playbackProgress'

/** How far the skip buttons jump. 15s is the audiobook convention: one lost sentence. */
export const SKIP_SECONDS = 15

/** Narration stays intelligible across this range; anything faster is novelty. */
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const

/** Sleep timer choices, in minutes, plus the two non-numeric modes. */
export const SLEEP_MINUTES = [5, 15, 30, 45, 60] as const

export type SleepMode = 'off' | 'end-of-chapter' | number

const RATE_STORAGE_KEY = 'audio-rate'

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const mm = hrs ? String(mins).padStart(2, '0') : String(mins)
  return `${hrs ? `${hrs}:` : ''}${mm}:${String(secs).padStart(2, '0')}`
}

/** Spoken form for assistive tech, which should hear "3 minutes 20 seconds", not "3:20". */
export function spokenTime(seconds: number, labels: { minutes: string; seconds: string }): string {
  if (!isFinite(seconds) || seconds < 0) return `0 ${labels.seconds}`
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return mins ? `${mins} ${labels.minutes} ${secs} ${labels.seconds}` : `${secs} ${labels.seconds}`
}

function readStoredRate(): number {
  try {
    const raw = Number(localStorage.getItem(RATE_STORAGE_KEY))
    return PLAYBACK_RATES.includes(raw as (typeof PLAYBACK_RATES)[number]) ? raw : 1
  } catch {
    return 1
  }
}

export interface PlayerEngine {
  current: Ref<AudioTrack | null>
  queue: Ref<AudioTrack[]>
  currentIndex: Ref<number>
  playing: Ref<boolean>
  loading: Ref<boolean>
  buffering: Ref<boolean>
  finished: Ref<boolean>
  /** Position through the current track, 0-100. */
  progress: Ref<number>
  duration: Ref<number>
  elapsed: ComputedRef<number>
  rate: Ref<number>
  sleepMode: Ref<SleepMode>
  /** Milliseconds left on a timed sleep timer; null when off or waiting for the chapter to end. */
  sleepRemainingMs: Ref<number | null>
  chapterQueue: ComputedRef<AudioTrack[]>
  hasNext: ComputedRef<boolean>
  hasPrevious: ComputedRef<boolean>
  trackKey: (track: AudioTrack) => string
  isCurrent: (track: AudioTrack) => boolean
  playTrack: (track: AudioTrack, newQueue?: AudioTrack[], resumeAt?: number | null) => Promise<void>
  toggle: () => void
  seek: (percent: number) => void
  skip: (seconds: number) => void
  next: () => void
  previous: () => void
  setRate: (value: number) => void
  setSleep: (mode: SleepMode) => void
  close: () => void
}

/**
 * Owns the single `<audio>` element and everything about playback.
 *
 * Kept out of the component so the mini bar, the expanded sheet and the chapter
 * list can all be dumb views over one source of truth. Must be called from a
 * component's `setup`: it binds to the mount lifecycle.
 */
export function usePlayerEngine(): PlayerEngine {
  const paywall = usePaywallStore()
  const auth = useAuthStore()

  let audio: HTMLAudioElement | null = null

  const current = ref<AudioTrack | null>(null)
  const queue = ref<AudioTrack[]>([])
  const currentIndex = ref(0)
  const playing = ref(false)
  const loading = ref(false)
  const buffering = ref(false)
  const finished = ref(false)
  const progress = ref(0)
  const duration = ref(0)
  const rate = ref(1)
  const sleepMode = ref<SleepMode>('off')
  const sleepRemainingMs = ref<number | null>(null)

  /** Track ids whose expired signed URL has already been re-requested once; cleared once a track plays again. */
  const refreshedTracks = new Set<string>()
  const progressReporter = createProgressReporter()
  /** Books whose stored position has already been applied, so resuming happens once per session. */
  const resumedBooks = new Set<string>()
  /** Percent to seek to as soon as the pending track reports its duration. */
  let pendingResumePercent: number | null = null
  let sleepTimer: ReturnType<typeof setInterval> | null = null

  const elapsed = computed(() => (progress.value / 100) * duration.value)
  const chapterQueue = computed<AudioTrack[]>(() =>
    queue.value.length ? queue.value : current.value ? [current.value] : [],
  )
  const hasNext = computed(() => currentIndex.value < queue.value.length - 1)
  const hasPrevious = computed(() => currentIndex.value > 0)

  const trackKey = (track: AudioTrack) => String(track.id)
  const isCurrent = (track: AudioTrack) =>
    Boolean(current.value && trackKey(current.value) === trackKey(track))

  function setCurrent(track: AudioTrack, newQueue: AudioTrack[] = []) {
    current.value = track
    queue.value = newQueue.length ? newQueue : [track]
    const idx = queue.value.findIndex((item) => trackKey(item) === trackKey(track))
    currentIndex.value = idx >= 0 ? idx : 0
  }

  /**
   * Applies a stored listening position. Seeking needs the duration, which is not
   * known until `loadedmetadata`, so an early call parks the percent instead.
   */
  function applyResume(percent: number) {
    if (!audio) return
    if (audio.duration) {
      audio.currentTime = (percent / 100) * audio.duration
      pendingResumePercent = null
    } else {
      pendingResumePercent = percent
    }
  }

  /**
   * Drops the listener back where they stopped, once per book per session.
   *
   * Starting at the head of a multi-chapter queue means "carry on with this book",
   * so playback moves to the stored chapter. Starting anywhere else is a deliberate
   * choice of chapter, and only the position inside that chapter is restored.
   */
  function scheduleResume(track: AudioTrack) {
    const bookId = bookIdOf(track)
    const chapterId = chapterIdOf(track)
    if (!bookId || !chapterId || !auth.isLoggedIn || resumedBooks.has(bookId)) return
    resumedBooks.add(bookId)
    const startedAtHead = queue.value.length > 1 && trackKey(queue.value[0]) === trackKey(track)

    void loadAudioPosition(bookId).then((position) => {
      if (!position) return
      // The listener may have moved on while the position was in flight.
      if (!current.value || trackKey(current.value) !== trackKey(track)) return
      if (position.chapterId === chapterId) {
        applyResume(position.percent)
        return
      }
      if (!startedAtHead) return
      const stored = queue.value.find((item) => chapterIdOf(item) === position.chapterId)
      if (!stored || stored.locked || !stored.url) return
      void playTrack(stored, queue.value, position.percent)
    })
  }

  async function playTrack(track: AudioTrack, newQueue?: AudioTrack[], resumeAt: number | null = null) {
    if (!audio) return
    if (track.locked || !track.url) {
      // Locked chapters never reach the <audio> element: the server gave us no URL.
      playing.value = false
      paywall.open(track.lockReason ?? 'subscription_required')
      return
    }
    setCurrent(track, newQueue ?? queue.value)
    loading.value = true
    playing.value = false
    buffering.value = false
    finished.value = false
    // Set before scheduling: a resume lookup resolves later and must win, not be reset.
    pendingResumePercent = resumeAt
    scheduleResume(track)
    try {
      audio.src = track.url
      audio.load()
      applyRate()
      await audio.play()
      playing.value = true
      // The URL worked, so a later expiry deserves a fresh refresh attempt.
      refreshedTracks.delete(trackKey(track))
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[AudioPlayer] playback error', err)
    } finally {
      loading.value = false
    }
  }

  function toggle() {
    if (!audio || !current.value) return
    if (playing.value) {
      audio.pause()
      playing.value = false
      void progressReporter.flush()
    } else {
      // After the queue has run out, play restarts the chapter instead of doing nothing.
      if (finished.value) {
        audio.currentTime = 0
        finished.value = false
      }
      audio.play().then(() => { playing.value = true }).catch(() => undefined)
    }
  }

  function seek(percent: number) {
    if (!audio || !duration.value) return
    const bounded = Math.max(0, Math.min(100, percent))
    audio.currentTime = (bounded / 100) * duration.value
  }

  function skip(seconds: number) {
    if (!audio || !duration.value) return
    audio.currentTime = Math.max(0, Math.min(duration.value, audio.currentTime + seconds))
  }

  function next() {
    if (!queue.value.length) return
    const nextIndex = currentIndex.value + 1
    if (nextIndex < queue.value.length) {
      // A locked next chapter opens the paywall instead of playing.
      void playTrack(queue.value[nextIndex], queue.value)
      return
    }
    // Nothing left to play: say so rather than leaving a dead play button.
    finished.value = true
    buffering.value = false
  }

  function previous() {
    if (!queue.value.length) return
    // Past the opening seconds, "previous" restarts the chapter, as every player does.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    const prevIndex = currentIndex.value - 1
    if (prevIndex >= 0) void playTrack(queue.value[prevIndex], queue.value)
  }

  function applyRate() {
    if (!audio) return
    audio.playbackRate = rate.value
    // Without pitch correction a sped-up narrator sounds comical.
    audio.preservesPitch = true
  }

  function setRate(value: number) {
    rate.value = value
    applyRate()
    try {
      localStorage.setItem(RATE_STORAGE_KEY, String(value))
    } catch {
      /* A listener with storage blocked simply loses the preference. */
    }
  }

  function stopSleepTimer() {
    if (sleepTimer) clearInterval(sleepTimer)
    sleepTimer = null
    sleepRemainingMs.value = null
  }

  function pauseForSleep() {
    if (audio && !audio.paused) {
      audio.pause()
      playing.value = false
      void progressReporter.flush()
    }
    sleepMode.value = 'off'
    stopSleepTimer()
  }

  function setSleep(mode: SleepMode) {
    sleepMode.value = mode
    stopSleepTimer()
    if (typeof mode !== 'number') return
    const endsAt = Date.now() + mode * 60_000
    sleepRemainingMs.value = endsAt - Date.now()
    sleepTimer = setInterval(() => {
      const left = endsAt - Date.now()
      sleepRemainingMs.value = Math.max(0, left)
      if (left <= 0) pauseForSleep()
    }, 1000)
  }

  function close() {
    // Record where they stopped before the track is torn down.
    void progressReporter.flush()
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    stopSleepTimer()
    sleepMode.value = 'off'
    current.value = null
    playing.value = false
    progress.value = 0
    duration.value = 0
    queue.value = []
    currentIndex.value = 0
    loading.value = false
    buffering.value = false
    finished.value = false
    pendingResumePercent = null
  }

  /* ── media element events ───────────────────────────────────────────── */

  function onTimeUpdate() {
    if (!audio) return
    duration.value = audio.duration || duration.value
    if (audio.duration) {
      progress.value = (audio.currentTime / audio.duration) * 100
      // Hold off until a pending resume has landed, or we would store 0% over the real position.
      if (playing.value && pendingResumePercent === null) {
        progressReporter.report(current.value, progress.value)
      }
    }
  }

  function onLoadedMetadata() {
    if (!audio) return
    duration.value = audio.duration || 0
    applyRate()
    if (pendingResumePercent !== null) applyResume(pendingResumePercent)
  }

  function onEnded() {
    playing.value = false
    buffering.value = false
    // A finished chapter is 100% listened; record that before moving on.
    progressReporter.report(current.value, 100)
    void progressReporter.flush()
    if (sleepMode.value === 'end-of-chapter') {
      sleepMode.value = 'off'
      finished.value = true
      return
    }
    next()
  }

  function onWaiting() {
    buffering.value = true
  }

  function onPlaying() {
    buffering.value = false
    playing.value = true
  }

  /** Signed audio URLs expire: on a load error request a fresh URL once and resume. */
  async function onAudioError() {
    const track = current.value
    if (!audio || !track || !track.source || refreshedTracks.has(trackKey(track))) return
    refreshedTracks.add(trackKey(track))
    const resumeAt = audio.currentTime || 0
    const result = await refreshTrackUrl(track)
    if (!result || !current.value || trackKey(current.value) !== trackKey(track)) return
    if ('locked' in result) {
      close()
      paywall.open(result.locked)
      return
    }
    const updated: AudioTrack = { ...track, url: result.url }
    queue.value = queue.value.map((item) => (trackKey(item) === trackKey(track) ? updated : item))
    current.value = updated
    try {
      audio.src = updated.url
      audio.load()
      if (resumeAt > 0) audio.currentTime = resumeAt
      applyRate()
      await audio.play()
      playing.value = true
    } catch { /* give up quietly */ }
  }

  function onExternalPlay(e: CustomEvent<PlayAudioDetail>) {
    if (e.detail?.track) void playTrack(e.detail.track, e.detail.queue)
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') void progressReporter.flush()
  }

  function onPageHide() {
    void progressReporter.flush()
  }

  /*
   * The mini player is fixed to the bottom of the viewport, so page chrome that
   * sits at the very bottom (the site footer) needs to know when it is there.
   */
  watch(current, (track) => {
    document.documentElement.classList.toggle('audio-player-open', Boolean(track))
  })

  onMounted(() => {
    if (typeof window === 'undefined') return
    rate.value = readStoredRate()
    audio = new Audio()
    audio.preload = 'metadata'
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('error', onAudioError)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('stalled', onWaiting)
    audio.addEventListener('playing', onPlaying)
    window.addEventListener('loikmon:playAudioTrack', onExternalPlay)
    // Closing the tab or switching away is the last chance to store the position.
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
  })

  onUnmounted(() => {
    void progressReporter.flush()
    stopSleepTimer()
    document.documentElement.classList.remove('audio-player-open')
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('error', onAudioError)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('stalled', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.load()
      audio = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('loikmon:playAudioTrack', onExternalPlay)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  return {
    current, queue, currentIndex, playing, loading, buffering, finished,
    progress, duration, elapsed, rate, sleepMode, sleepRemainingMs,
    chapterQueue, hasNext, hasPrevious,
    trackKey, isCurrent,
    playTrack, toggle, seek, skip, next, previous, setRate, setSleep, close,
  }
}
