import { books as booksApi } from '@loikmon/api'
import type { AudioTrack } from '@/stores/bookAudio'

/**
 * Listening position, stored in the same `reading_progress` row the reader uses.
 *
 * There is one row per (user, book, format), so for `format: 'audio'` we keep
 * the chapter id in `location` and how far through that chapter the listener is
 * in `progress`. That is enough to drop them back exactly where they stopped.
 */
export interface AudioPosition {
  chapterId: string
  percent: number
}

/** Below this the listener had barely started; at or above it the chapter is finished. */
const RESUME_MIN_PERCENT = 1
const RESUME_MAX_PERCENT = 98

/** How often a playing chapter reports its position. */
export const SAVE_INTERVAL_MS = 15_000

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** Book id for a track that came from a book chapter (article narration has no position to restore). */
export function bookIdOf(track: AudioTrack | null | undefined): string | null {
  const source = track?.source
  return source && source.kind === 'book' ? String(source.bookId) : null
}

export function chapterIdOf(track: AudioTrack | null | undefined): string | null {
  const source = track?.source
  return source && source.kind === 'book' ? String(source.chapterId) : null
}

/**
 * Last stored audio position for a book, or null when there is nothing worth
 * resuming. Progress is a convenience: a failure here must never stop playback,
 * so every error resolves to null.
 */
export async function loadAudioPosition(bookId: string | number): Promise<AudioPosition | null> {
  try {
    const { data } = await booksApi.getProgress(bookId)
    const row = (data.progress ?? []).find((entry) => entry.format === 'audio')
    if (!row?.location) return null
    const percent = clampPercent(Number(row.progress))
    if (percent < RESUME_MIN_PERCENT || percent > RESUME_MAX_PERCENT) return null
    return { chapterId: String(row.location), percent }
  } catch {
    return null
  }
}

export interface ProgressReporter {
  /** Records the current position; sends it at most once per `SAVE_INTERVAL_MS`. */
  report(track: AudioTrack | null | undefined, percent: number): void
  /** Sends whatever was recorded last, ignoring the interval (pause, close, chapter end, tab hidden). */
  flush(): Promise<void>
  /** Forgets any unsent position, e.g. after signing out. */
  reset(): void
}

/**
 * Throttled writer for the listening position.
 *
 * `timeupdate` fires several times a second, so positions are buffered and sent
 * on an interval, plus once more whenever playback settles.
 */
export function createProgressReporter(
  save: typeof booksApi.saveProgress = booksApi.saveProgress,
  now: () => number = Date.now,
): ProgressReporter {
  let pending: { bookId: string; chapterId: string; percent: number } | null = null
  let lastSentAt = 0

  async function flush(): Promise<void> {
    const next = pending
    if (!next) return
    pending = null
    lastSentAt = now()
    try {
      await save(next.bookId, {
        format: 'audio',
        location: next.chapterId,
        progress: clampPercent(next.percent),
      })
    } catch {
      /* Best effort: losing a position is not worth surfacing to the listener. */
    }
  }

  return {
    report(track, percent) {
      const bookId = bookIdOf(track)
      const chapterId = chapterIdOf(track)
      if (!bookId || !chapterId || !Number.isFinite(percent)) return
      pending = { bookId, chapterId, percent: clampPercent(percent) }
      if (now() - lastSentAt >= SAVE_INTERVAL_MS) void flush()
    },
    flush,
    reset() {
      pending = null
      lastSentAt = 0
    },
  }
}
