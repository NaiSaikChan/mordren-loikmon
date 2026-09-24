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

/**
 * What is written under `audio_position:<bookId>`.
 *
 * `updatedAt` and `dirty` were added later: values written by older builds
 * carry neither and still load (they simply lose any tie against the server).
 */
export interface StoredAudioPosition extends AudioPosition {
  /** Epoch millis when the listener was at this position. */
  updatedAt?: number
  /** True until the server has confirmed it holds this position. */
  dirty?: boolean
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

/** The raw device record, tolerant of values written before `updatedAt`/`dirty` existed. */
export async function readLocalRecord(bookId: string): Promise<StoredAudioPosition | null> {
  const saved = await storage.getJSON<Partial<StoredAudioPosition>>(`${LOCAL_KEY_PREFIX}${bookId}`)
  if (!saved?.chapterId) return null
  const updatedAt = Number(saved.updatedAt)
  return {
    chapterId: String(saved.chapterId),
    percent: clampPercent(Number(saved.percent)),
    ...(Number.isFinite(updatedAt) && updatedAt > 0 ? { updatedAt } : {}),
    ...(saved.dirty ? { dirty: true } : {}),
  }
}

export async function readLocalPosition(bookId: string): Promise<AudioPosition | null> {
  const saved = await readLocalRecord(bookId)
  if (!saved || !worthResuming(saved.percent)) return null
  return { chapterId: saved.chapterId, percent: saved.percent }
}

async function writeLocalPosition(bookId: string, position: StoredAudioPosition): Promise<void> {
  try {
    await storage.setJSON(`${LOCAL_KEY_PREFIX}${bookId}`, position)
  } catch {
    /* A device without writable storage still plays fine. */
  }
}

/** Server timestamps are ISO strings; tolerate MySQL-style `YYYY-MM-DD HH:MM:SS` (UTC) too. */
function parseServerTime(value: string | null | undefined): number | null {
  if (!value) return null
  let iso = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2} \d/.test(iso)) iso = iso.replace(' ', 'T')
  if (/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(iso)) iso = `${iso}Z`
  const at = Date.parse(iso)
  return Number.isNaN(at) ? null : at
}

/**
 * Last stored position for a book. Progress is a convenience, so every failure
 * resolves to the local copy or null — it must never stop playback.
 *
 * When signed in both copies are considered: the server's wins unless this
 * device holds a newer position the server never received (`dirty`), e.g. one
 * recorded offline. Old device records without a timestamp never beat the server.
 */
export async function loadAudioPosition(bookId: string | number, isLoggedIn: boolean): Promise<AudioPosition | null> {
  const key = String(bookId)
  const local = await readLocalRecord(key).catch(() => null)
  const finish = (chosen: AudioPosition | null): AudioPosition | null =>
    chosen && worthResuming(chosen.percent) ? { chapterId: chosen.chapterId, percent: chosen.percent } : null

  if (!isLoggedIn) return finish(local)

  let server: (AudioPosition & { updatedAt: number | null }) | null = null
  try {
    const { data } = await booksApi.getProgress(key)
    const row = (data.progress ?? []).find((entry) => entry.format === 'audio')
    if (row?.location) {
      server = {
        chapterId: String(row.location),
        percent: clampPercent(Number(row.progress)),
        updatedAt: parseServerTime(row.updated_at),
      }
    }
  } catch {
    return finish(local)
  }

  if (!server) return finish(local)
  if (local?.dirty && local.updatedAt && (server.updatedAt === null || local.updatedAt >= server.updatedAt)) {
    return finish(local)
  }
  // Legacy behaviour: a server row not worth resuming still lets a device copy through.
  return finish(server) ?? (local && !local.updatedAt ? finish(local) : null)
}

/**
 * How a resume should land, following the once-per-book heuristic:
 * starting at the head of a multi-chapter queue means "carry on with this book"
 * (jump to the stored chapter); starting anywhere else is a deliberate chapter
 * choice, so only the position inside that chapter is restored.
 */
export type ResumePlan =
  | { kind: 'seek'; percent: number }
  | { kind: 'jump'; index: number; percent: number }
  | null

export function planResume(
  track: AudioTrack,
  index: number,
  queue: readonly AudioTrack[],
  position: AudioPosition | null,
): ResumePlan {
  if (!position) return null
  if (String(track.chapterId ?? '') === position.chapterId) return { kind: 'seek', percent: position.percent }
  if (index !== 0 || queue.length < 2) return null
  const storedIndex = queue.findIndex((item) => String(item.chapterId ?? '') === position.chapterId)
  if (storedIndex < 0) return null
  return { kind: 'jump', index: storedIndex, percent: position.percent }
}

/** Sentinel for {@link withTimeout}: the promise was still pending when time ran out. */
export const TIMED_OUT: unique symbol = Symbol('timed-out')

/**
 * Races a promise against a timer. Used so a slow progress GET can delay the
 * start of playback by at most a short bound; the late result is still delivered
 * through `promise` to whoever keeps a handle on it.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export interface ProgressReporter {
  /** Records the current position; sends it to the server at most once per `SAVE_INTERVAL_MS`. */
  report(track: AudioTrack | null | undefined, percent: number): void
  /**
   * Sends whatever was recorded last, ignoring the interval (pause, stop, chapter
   * end, backgrounding). With nothing new, retries a save that previously failed.
   */
  flush(): Promise<void>
  /** Forgets any unsent position, e.g. after signing out. */
  reset(): void
}

interface Entry {
  bookId: string
  chapterId: string
  percent: number
  at: number
}

/**
 * Throttled writer for the listening position.
 *
 * Playback status updates several times a second, so positions are buffered and
 * sent on an interval, plus once more whenever playback settles. The device copy
 * is written on every flush regardless of sign-in state, marked `dirty` until the
 * server confirms it; a failed save is retried on the next flush.
 */
export function createProgressReporter(
  isLoggedIn: () => boolean,
  save: typeof booksApi.saveProgress = booksApi.saveProgress,
  now: () => number = Date.now,
): ProgressReporter {
  let pending: Entry | null = null
  /** Written to the device but not (yet) accepted by the server. */
  let unsynced: Entry | null = null
  let lastSentAt = 0
  /** Flushes run one at a time so an older write can never land after a newer one. */
  let chain: Promise<void> = Promise.resolve()
  let generation = 0

  async function runFlush(gen: number, fresh: Entry | null): Promise<void> {
    const entry = fresh ?? unsynced
    if (!entry) return
    const position = { chapterId: entry.chapterId, percent: entry.percent, updatedAt: entry.at }
    if (fresh) await writeLocalPosition(entry.bookId, { ...position, dirty: true })
    if (!isLoggedIn()) {
      unsynced = entry
      return
    }
    try {
      await save(entry.bookId, { format: 'audio', location: entry.chapterId, progress: entry.percent })
      if (gen !== generation) return
      // A newer position for the same book supersedes an older failed one.
      if (unsynced && (unsynced === entry || unsynced.bookId === entry.bookId)) unsynced = null
      // Only clear the flag when nothing newer has been recorded for this book since.
      const latest = pending as Entry | null
      if (!latest || latest.bookId !== entry.bookId) {
        await writeLocalPosition(entry.bookId, { ...position, dirty: false })
      }
    } catch {
      /* The device copy already holds it; the next flush retries. */
      if (gen === generation) unsynced = entry
    }
  }

  function flush(): Promise<void> {
    // Take the position now, so a reset() after this call cannot drop it.
    const gen = generation
    const fresh = pending
    pending = null
    if (fresh || unsynced) lastSentAt = now()
    chain = chain.then(() => runFlush(gen, fresh)).catch(() => undefined)
    return chain
  }

  return {
    report(track, percent) {
      const bookId = bookIdOf(track)
      const chapterId = chapterIdOf(track)
      if (!bookId || !chapterId || !Number.isFinite(percent)) return
      pending = { bookId, chapterId, percent: clampPercent(percent), at: now() }
      if (now() - lastSentAt >= SAVE_INTERVAL_MS) void flush()
    },
    flush,
    reset() {
      generation += 1
      pending = null
      unsynced = null
      lastSentAt = 0
    },
  }
}
