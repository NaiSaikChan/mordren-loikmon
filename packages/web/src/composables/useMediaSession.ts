import { watch, onUnmounted } from 'vue'
import { SKIP_SECONDS, type PlayerEngine } from '@/composables/usePlayerEngine'

/**
 * Publishes the current chapter to the OS via the Media Session API, so hardware
 * media keys, headset buttons, the Android notification and the macOS Now Playing
 * panel drive the same player the page does.
 *
 * Entirely progressive: browsers without it simply get nothing.
 */
export function useMediaSession(engine: PlayerEngine) {
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
  if (!session) return

  function setHandler(action: MediaSessionAction, handler: (() => void) | null) {
    try {
      session!.setActionHandler(action, handler)
    } catch {
      /* Not every browser implements every action. */
    }
  }

  watch(
    engine.current,
    (track) => {
      if (!track) {
        session.metadata = null
        session.playbackState = 'none'
        return
      }
      try {
        session.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist || undefined,
          artwork: track.cover ? [{ src: track.cover }] : undefined,
        })
      } catch {
        /* MediaMetadata is unavailable in a few engines that still expose mediaSession. */
      }
    },
    { immediate: true },
  )

  watch(
    engine.playing,
    (isPlaying) => {
      if (!engine.current.value) return
      session.playbackState = isPlaying ? 'playing' : 'paused'
    },
    { immediate: true },
  )

  // Keep the OS scrubber in step with playback.
  watch([engine.elapsed, engine.duration, engine.rate], ([position, duration, rate]) => {
    if (!duration || !isFinite(duration)) return
    try {
      session.setPositionState?.({
        duration,
        position: Math.min(position, duration),
        playbackRate: rate,
      })
    } catch {
      /* Position state rejects non-finite values in some engines. */
    }
  })

  setHandler('play', () => engine.toggle())
  setHandler('pause', () => engine.toggle())
  setHandler('previoustrack', () => engine.previous())
  setHandler('nexttrack', () => engine.next())
  setHandler('seekbackward', () => engine.skip(-SKIP_SECONDS))
  setHandler('seekforward', () => engine.skip(SKIP_SECONDS))
  setHandler('stop', () => engine.close())

  onUnmounted(() => {
    for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'stop'] as const) {
      setHandler(action, null)
    }
    session.metadata = null
    session.playbackState = 'none'
  })
}
