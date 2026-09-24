import { books as booksApi, type ReadingProgress } from '@loikmon/api'
import { storage } from '@/services/storage'

/**
 * Reading position for the EPUB and PDF readers, stored in the same
 * `reading_progress` row (one per user, book and format) the web reader and the
 * audiobook player use:
 *
 *  - EPUB: `location` = CFI, `progress` = percent through the book.
 *  - PDF:  `location` = page number, `progress` = page / total pages as a percent.
 *
 * A copy lives on the device (with the time it was recorded) so a position
 * survives being offline and works signed out. When both copies exist the
 * newer one wins. Progress is a convenience: every failure resolves to the
 * local copy or `null` and must never stop a book from opening.
 */

export type ReadingFormat = 'pdf' | 'epub'

export interface ReadingPosition {
  location: string
  /** 0-100. */
  progress: number
  /** Epoch ms of when the position was recorded; 0 when unknown (older saves). */
  updatedAt: number
}

/** How often an open book reports its position to the server. */
export const READING_SAVE_INTERVAL_MS = 15_000

const LOCAL_KEY_PREFIX = 'reading_position:'

export function localPositionKey(bookId: string | number, format: ReadingFormat): string {
  return `${LOCAL_KEY_PREFIX}${bookId}:${format}`
}

export function clampProgress(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
}

/** Parses the server's `updated_at` (ISO, or MySQL `YYYY-MM-DD HH:mm:ss[.SSS]`). */
export function parseTimestamp(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string' || !value) return 0
  // MySQL-style "YYYY-MM-DD HH:mm:ss" has no zone and engines disagree on it
  // (Hermes may reject it, V8 reads local time): treat it as UTC explicitly.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)) {
    const iso = value.replace(' ', 'T')
    const withZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`
    const parsed = Date.parse(withZone)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const direct = Date.parse(value)
  return Number.isFinite(direct) ? direct : 0
}

/**
 * Normalises a stored or received position. Tolerates older/looser shapes: a
 * numeric location (PDF page), a string progress (MySQL decimals), a missing
 * `updatedAt`. Returns null when there is no usable location.
 */
export function normalizePosition(raw: unknown): ReadingPosition | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const loc = r.location ?? r.cfi ?? r.page
  if (loc == null) return null
  const location = String(loc).trim()
  if (!location) return null
  return {
    location,
    progress: clampProgress(r.progress ?? r.percent ?? 0),
    updatedAt: parseTimestamp(r.updatedAt ?? r.updated_at),
  }
}

/** The newer of two positions; on a tie the first (server) copy wins. */
export function newerPosition(
  a: ReadingPosition | null,
  b: ReadingPosition | null,
): ReadingPosition | null {
  if (!a) return b
  if (!b) return a
  return b.updatedAt > a.updatedAt ? b : a
}

export async function readLocalReadingPosition(
  bookId: string | number,
  format: ReadingFormat,
): Promise<ReadingPosition | null> {
  try {
    return normalizePosition(await storage.getJSON<unknown>(localPositionKey(bookId, format)))
  } catch {
    return null
  }
}

export async function writeLocalReadingPosition(
  bookId: string | number,
  format: ReadingFormat,
  position: ReadingPosition,
): Promise<void> {
  try {
    await storage.setJSON(localPositionKey(bookId, format), position)
  } catch {
    /* A device without writable storage still reads fine. */
  }
}

export function serverPosition(rows: ReadingProgress[] | undefined, format: ReadingFormat): ReadingPosition | null {
  const row = (rows ?? []).find((entry) => entry.format === format)
  return row ? normalizePosition(row) : null
}

/**
 * Last stored position for a book in one format: whichever of the server's and
 * this device's copies is newer. Signed out, or when the server is unreachable,
 * only the device copy is consulted.
 */
export async function loadReadingPosition(
  bookId: string | number,
  format: ReadingFormat,
  isLoggedIn: boolean,
  getProgress: typeof booksApi.getProgress = booksApi.getProgress,
): Promise<ReadingPosition | null> {
  const local = await readLocalReadingPosition(bookId, format)
  if (!isLoggedIn) return local
  try {
    const { data } = await getProgress(String(bookId))
    return newerPosition(serverPosition(data?.progress, format), local)
  } catch {
    return local
  }
}

export interface ReadingProgressReporter {
  /** Records the current position locally and schedules a throttled server write. */
  report(location: string, progress: number): void
  /** Sends whatever was recorded last, ignoring the interval (unmount, backgrounding). */
  flush(): Promise<void>
  /** Cancels any scheduled send. Call `flush()` first to keep the last position. */
  dispose(): void
}

export interface ReporterOptions {
  bookId: string | number
  format: ReadingFormat
  isLoggedIn: () => boolean
  save?: typeof booksApi.saveProgress
  now?: () => number
  intervalMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

/**
 * Throttled writer for a reading position. Page turns write the device copy
 * straight away; the server gets at most one write per interval, with a
 * trailing write scheduled so the last page turned is never lost.
 */
export function createReadingProgressReporter(options: ReporterOptions): ReadingProgressReporter {
  const {
    bookId,
    format,
    isLoggedIn,
    save = booksApi.saveProgress,
    now = Date.now,
    intervalMs = READING_SAVE_INTERVAL_MS,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options

  let pending: ReadingPosition | null = null
  let lastSentAt = 0
  let timer: unknown = null
  let disposed = false

  function cancelTimer() {
    if (timer != null) clearTimer(timer)
    timer = null
  }

  async function send(): Promise<void> {
    cancelTimer()
    const next = pending
    if (!next) return
    pending = null
    if (!isLoggedIn()) return
    lastSentAt = now()
    try {
      await save(String(bookId), { format, location: next.location, progress: next.progress })
    } catch {
      /* The device copy already holds it; losing the sync is not worth surfacing. */
    }
  }

  return {
    report(location, progress) {
      if (disposed || !location) return
      const position: ReadingPosition = { location: String(location), progress: clampProgress(progress), updatedAt: now() }
      pending = position
      void writeLocalReadingPosition(bookId, format, position)
      if (!isLoggedIn()) {
        pending = null
        return
      }
      const wait = lastSentAt + intervalMs - now()
      if (wait <= 0) {
        void send()
      } else if (timer == null) {
        timer = setTimer(() => {
          timer = null
          void send()
        }, wait)
      }
    },
    flush: send,
    dispose() {
      disposed = true
      cancelTimer()
    },
  }
}

/** A PDF position in the shape stored on the server. */
export function pdfPosition(page: number, pages: number): { location: string; progress: number } | null {
  if (!Number.isFinite(page) || page < 1) return null
  const total = Number.isFinite(pages) && pages > 0 ? pages : page
  return { location: String(Math.floor(page)), progress: clampProgress((Math.floor(page) / total) * 100) }
}

/** Page to reopen a PDF at, or null for "start at the top". */
export function pdfPageFrom(position: ReadingPosition | null): number | null {
  if (!position) return null
  const page = Number.parseInt(position.location, 10)
  return Number.isFinite(page) && page > 1 ? page : null
}

/** EPUB CFIs always start with `epubcfi(`; anything else (e.g. an href) is not restored. */
export function epubCfiFrom(position: ReadingPosition | null): string | null {
  if (!position) return null
  return position.location.startsWith('epubcfi(') ? position.location : null
}
