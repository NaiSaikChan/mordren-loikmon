import { books as booksApi } from '@loikmon/api'
import { storage } from '@/services/storage'
import type { AudioTrack } from './audio'

/**
 * Listening position, stored in the same `reading_progress` row the reader uses.
 *
 * There is one row per (user, book, format), so for `format: 'audio'` the chapter
 * id goes in `location` and how far through that chapter the listener is goes in
 * `progress`. A copy is kept on the device so a position survives being offline
 * and is available instantly on the next launch.
 */
export interface AudioPosition {
  chapterId: string
  percent: number
}

/** Below this the listener had barely started; at or above it the chapter is finished. */
const RESUME_MIN_PERCENT = 1
const RESUME_MAX_PERCENT = 98

/** How often a playing chapter reports its position to the server. */
export const SAVE_INTERVAL_MS = 15_000

const LOCAL_KEY_PREFIX = 'audio_position:'

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function worthResuming(percent: number): boolean {
  return percent >= RESUME_MIN_PERCENT && percent <= RESUME_MAX_PERCENT
}

/** Book id for a track that came from a book chapter; article narration has no position to restore. */
export function bookIdOf(track: AudioTrack | null | undefined): string | null {
  if (!track || track.sourceType !== 'book' || track.sourceBookId == null) return null
  return String(track.sourceBookId)
}

export function chapterIdOf(track: AudioTrack | null | undefined): string | null {
  if (!track || track.sourceType !== 'book' || track.chapterId == null) return null
  return String(track.chapterId)
}

export async function readLocalPosition(bookId: string): Promise<AudioPosition | null> {
  const saved = await storage.getJSON<AudioPosition>(`${LOCAL_KEY_PREFIX}${bookId}`)
  if (!saved?.chapterId || !worthResuming(clampPercent(saved.percent))) return null
  return { chapterId: String(saved.chapterId), percent: clampPercent(saved.percent) }
}

async function writeLocalPosition(bookId: string, position: AudioPosition): Promise<void> {
  try {
    await storage.setJSON(`${LOCAL_KEY_PREFIX}${bookId}`, position)
  } catch {
    /* A device without writable storage still plays fine. */
  }
}

/**
 * Last stored position for a book: the server's copy when signed in and reachable,
 * otherwise this device's. Progress is a convenience, so every failure resolves
 * to the local copy or null — it must never stop playback.
 */
export async function loadAudioPosition(bookId: string | number, isLoggedIn: boolean): Promise<AudioPosition | null> {
  const key = String(bookId)
  const local = await readLocalPosition(key).catch(() => null)
  if (!isLoggedIn) return local
  try {
    const { data } = await booksApi.getProgress(key)
    const row = (data.progress ?? []).find((entry) => entry.format === 'audio')
    if (!row?.location) return local
    const percent = clampPercent(Number(row.progress))
    if (!worthResuming(percent)) return local
    return { chapterId: String(row.location), percent }
  } catch {
    return local
  }
}

export interface ProgressReporter {
  /** Records the current position; sends it to the server at most once per `SAVE_INTERVAL_MS`. */
  report(track: AudioTrack | null | undefined, percent: number): void
  /** Sends whatever was recorded last, ignoring the interval (pause, stop, chapter end, backgrounding). */
  flush(): Promise<void>
  /** Forgets any unsent position, e.g. after signing out. */
  reset(): void
}

/**
 * Throttled writer for the listening position.
 *
 * Playback status updates several times a second, so positions are buffered and
 * sent on an interval, plus once more whenever playback settles. The device copy
 * is written on every flush regardless of sign-in state.
 */
export function createProgressReporter(
  isLoggedIn: () => boolean,
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
    const position: AudioPosition = { chapterId: next.chapterId, percent: next.percent }
    await writeLocalPosition(next.bookId, position)
    if (!isLoggedIn()) return
    try {
      await save(next.bookId, { format: 'audio', location: next.chapterId, progress: next.percent })
    } catch {
      /* The device copy already holds it; losing the sync is not worth surfacing. */
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
