import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { storage } from '@/services/storage'

/**
 * On-device cache of book files (EPUB and PDF) for the readers.
 *
 * - Android: lives under `documentDirectory`, so the OS cannot purge a book
 *   halfway through reading it (app backup is disabled in app.json).
 * - iOS: lives under `cacheDirectory` (Library/Caches). Documents/ is backed
 *   up to iCloud and App Review rejects re-downloadable content stored there
 *   (guideline 2.23 / iOS Data Storage Guidelines); the legacy file-system API
 *   cannot mark files do-not-backup. iOS only purges Caches under storage
 *   pressure, and a purged file is simply downloaded again.
 * - The size cap below keeps it bounded on both.
 * - Keyed per book + format (never by the signed URL, whose query string
 *   changes every request) and tagged with a version: the book's `updated_at`
 *   when the caller knows it, otherwise the server's ETag. A version mismatch
 *   means the file was replaced and is downloaded again.
 * - Least-recently-opened books are evicted once the total passes the cap.
 * - A download is only committed after it completed with HTTP 200.
 */

export const DOCUMENT_CACHE_MAX_BYTES = 500 * 1024 * 1024
const INDEX_KEY = 'document_cache_index:v1'
const DIR_NAME = 'documents/'
/** Old cache locations used before this module existed; deleted once. */
const LEGACY_CACHE_DIRS = ['epubs/', 'pdf-view/']

export type DocumentExt = 'pdf' | 'epub'

export interface CacheEntry {
  key: string
  /** File name inside the cache directory. */
  file: string
  /** Caller-supplied version (e.g. the book's `updated_at`), if known. */
  version: string | null
  /** Server ETag seen when the file was downloaded, if any. */
  etag: string | null
  size: number
  lastAccess: number
}

type CacheIndex = Record<string, CacheEntry>

export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`Download failed: HTTP ${status}`)
  }
}

export class DownloadCancelledError extends Error {
  constructor() {
    super('Download cancelled')
  }
}

/** Signed URLs expire: S3/MinIO answer 403 (or 400/401) once the signature is stale. */
export function isExpiredStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function documentCacheKey(bookId: string | number, format: DocumentExt): string {
  return `book-${bookId}-${format}`
}

export function safeFileName(key: string, ext: DocumentExt): string {
  return `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`
}

/**
 * Whether a cached entry is still the current file.
 *  - Both sides know the caller version → compare those.
 *  - Otherwise compare ETags when both are known.
 *  - Nothing to compare (offline, server sent no ETag) → trust the cache.
 */
export function isEntryFresh(
  entry: Pick<CacheEntry, 'version' | 'etag'>,
  expected: { version?: string | null; etag?: string | null },
): boolean {
  if (entry.version && expected.version) return entry.version === expected.version
  if (entry.etag && expected.etag) return normalizeEtag(entry.etag) === normalizeEtag(expected.etag)
  return true
}

export function normalizeEtag(etag: string): string {
  return etag.replace(/^W\//, '').replace(/"/g, '').trim()
}

/**
 * Keys to evict, least recently used first, until the total is at or below
 * `maxBytes`. `keep` (the book being opened) is never evicted.
 */
export function selectEvictions(entries: CacheEntry[], maxBytes: number, keep?: string): string[] {
  let total = entries.reduce((sum, e) => sum + Math.max(0, e.size || 0), 0)
  if (total <= maxBytes) return []
  const victims: string[] = []
  const candidates = entries.filter((e) => e.key !== keep).sort((a, b) => a.lastAccess - b.lastAccess)
  for (const entry of candidates) {
    if (total <= maxBytes) break
    victims.push(entry.key)
    total -= Math.max(0, entry.size || 0)
  }
  return victims
}

function headerValue(headers: Record<string, string> | undefined, name: string): string | null {
  if (!headers) return null
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && v) return String(v)
  }
  return null
}

// ---------------------------------------------------------------------------
// Index (AsyncStorage), serialised so concurrent opens cannot lose updates
// ---------------------------------------------------------------------------

let queue: Promise<unknown> = Promise.resolve()
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

async function readIndex(): Promise<CacheIndex> {
  try {
    const raw = await storage.getJSON<CacheIndex>(INDEX_KEY)
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

async function writeIndex(index: CacheIndex): Promise<void> {
  try {
    await storage.setJSON(INDEX_KEY, index)
  } catch {
    /* Losing the index only costs a re-download. */
  }
}

export function cacheDirectory(): string {
  const root = Platform.OS === 'ios' ? FileSystem.cacheDirectory : FileSystem.documentDirectory
  return (root ?? '') + DIR_NAME
}

let legacyCleaned = false
async function ensureDir(): Promise<string> {
  const dir = cacheDirectory()
  const info = await FileSystem.getInfoAsync(dir)
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
  if (!legacyCleaned) {
    legacyCleaned = true
    for (const legacy of LEGACY_CACHE_DIRS) {
      void FileSystem.deleteAsync((FileSystem.cacheDirectory ?? '') + legacy, { idempotent: true }).catch(
        () => undefined,
      )
    }
  }
  return dir
}

/** The cached entry for `key` if its file is still on disk. */
export async function getCachedDocument(key: string): Promise<(CacheEntry & { uri: string }) | null> {
  const index = await readIndex()
  const entry = index[key]
  if (!entry) return null
  const uri = cacheDirectory() + entry.file
  try {
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists || !(info.size ?? 0)) {
      await serialized(async () => {
        const fresh = await readIndex()
        delete fresh[key]
        await writeIndex(fresh)
      })
      return null
    }
  } catch {
    return null
  }
  return { ...entry, uri }
}

async function touch(key: string, now: number): Promise<void> {
  await serialized(async () => {
    const index = await readIndex()
    if (!index[key]) return
    index[key] = { ...index[key], lastAccess: now }
    await writeIndex(index)
  })
}

async function commitEntry(entry: CacheEntry, maxBytes: number): Promise<void> {
  await serialized(async () => {
    const index = await readIndex()
    index[entry.key] = entry
    const victims = selectEvictions(Object.values(index), maxBytes, entry.key)
    for (const key of victims) {
      const victim = index[key]
      delete index[key]
      if (victim.file !== entry.file) {
        await FileSystem.deleteAsync(cacheDirectory() + victim.file, { idempotent: true }).catch(() => undefined)
      }
    }
    await writeIndex(index)
  })
}

/** Removes one document (e.g. a corrupt file the viewer could not open). */
export async function removeCachedDocument(key: string): Promise<void> {
  await serialized(async () => {
    const index = await readIndex()
    const entry = index[key]
    if (!entry) return
    delete index[key]
    await FileSystem.deleteAsync(cacheDirectory() + entry.file, { idempotent: true }).catch(() => undefined)
    await writeIndex(index)
  })
}

// ---------------------------------------------------------------------------
// Remote checks and download
// ---------------------------------------------------------------------------

/**
 * Asks the server for the file's ETag with a one-byte ranged GET (presigned
 * URLs are only valid for GET, so HEAD is not an option). Null on any failure:
 * the caller then trusts its cached copy.
 */
export async function probeRemoteEtag(url: string, timeoutMs = 6000): Promise<string | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: controller?.signal })
    if (res.status !== 200 && res.status !== 206) return null
    const etag = res.headers.get('etag')
    // Do not read a full 200 body: dropping it lets the connection go.
    return etag ? etag : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface DownloadProgress {
  written: number
  /** -1 when the server did not send a length. */
  total: number
}

export interface ResolveOptions {
  key: string
  ext: DocumentExt
  /** Signed URL, or null when it could not be fetched (offline). */
  url: string | null
  /** The book's `updated_at` (or similar), when known. */
  version?: string | null
  refreshUrl?: () => Promise<string | null>
  onProgress?: (progress: DownloadProgress) => void
  signal?: AbortSignal
  maxBytes?: number
  now?: () => number
  probe?: (url: string) => Promise<string | null>
}

export interface ResolvedDocument {
  uri: string
  size: number
  fromCache: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DownloadCancelledError()
}

async function download(
  url: string,
  dest: string,
  onProgress: ResolveOptions['onProgress'],
  signal: AbortSignal | undefined,
): Promise<FileSystem.FileSystemDownloadResult> {
  const task = FileSystem.createDownloadResumable(url, dest, {}, (p) => {
    onProgress?.({ written: p.totalBytesWritten, total: p.totalBytesExpectedToWrite })
  })
  const abort = () => {
    void task.cancelAsync().catch(() => undefined)
  }
  signal?.addEventListener('abort', abort)
  try {
    throwIfAborted(signal)
    const result = await task.downloadAsync()
    if (!result || signal?.aborted) throw new DownloadCancelledError()
    return result
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

/**
 * Returns a local file for the book: the cached copy when it is still current
 * (or when the network is unavailable), otherwise a fresh download.
 */
export async function resolveDocument(options: ResolveOptions): Promise<ResolvedDocument> {
  const {
    key,
    ext,
    url,
    version = null,
    refreshUrl,
    onProgress,
    signal,
    maxBytes = DOCUMENT_CACHE_MAX_BYTES,
    now = Date.now,
    probe = probeRemoteEtag,
  } = options

  const cached = await getCachedDocument(key).catch(() => null)
  throwIfAborted(signal)

  if (cached) {
    let fresh = true
    if (url) {
      if (version && cached.version) {
        fresh = isEntryFresh(cached, { version })
      } else if (cached.etag) {
        fresh = isEntryFresh(cached, { etag: await probe(url) })
      }
    }
    throwIfAborted(signal)
    if (fresh) {
      void touch(key, now())
      return { uri: cached.uri, size: cached.size, fromCache: true }
    }
  }

  if (!url) throw new Error('Offline and not downloaded')

  try {
    return await downloadFresh({ key, ext, url, version, refreshUrl, onProgress, signal, maxBytes, now })
  } catch (err) {
    // A newer version exists but could not be fetched: an older copy beats no book.
    if (cached && !(err instanceof DownloadCancelledError)) {
      void touch(key, now())
      return { uri: cached.uri, size: cached.size, fromCache: true }
    }
    throw err
  }
}

async function downloadFresh(
  options: Required<Pick<ResolveOptions, 'key' | 'ext' | 'maxBytes' | 'now'>> &
    Pick<ResolveOptions, 'refreshUrl' | 'onProgress' | 'signal'> & { url: string; version: string | null },
): Promise<ResolvedDocument> {
  const { key, ext, url, version, refreshUrl, onProgress, signal, maxBytes, now } = options
  const dir = await ensureDir()
  const file = safeFileName(key, ext)
  const finalUri = dir + file
  const partUri = `${finalUri}.${now()}.${Math.floor(Math.random() * 1e6)}.part`

  try {
    let result = await download(url, partUri, onProgress, signal)
    // The signed URL may have expired before the download started: fetch a fresh one once.
    if (isExpiredStatus(result.status) && refreshUrl) {
      const next = await refreshUrl()
      throwIfAborted(signal)
      if (next) result = await download(next, partUri, onProgress, signal)
    }
    if (result.status !== 200) throw new HttpStatusError(result.status)

    const info = await FileSystem.getInfoAsync(partUri)
    const size = info.exists ? (info.size ?? 0) : 0
    if (!size) throw new Error('The file is empty')
    throwIfAborted(signal)

    await FileSystem.deleteAsync(finalUri, { idempotent: true }).catch(() => undefined)
    await FileSystem.moveAsync({ from: partUri, to: finalUri })
    await commitEntry(
      { key, file, version, etag: headerValue(result.headers, 'etag'), size, lastAccess: now() },
      maxBytes,
    )
    return { uri: finalUri, size, fromCache: false }
  } finally {
    await FileSystem.deleteAsync(partUri, { idempotent: true }).catch(() => undefined)
  }
}

/** Test hook: forget the one-time legacy cleanup flag. */
export function __resetForTests() {
  legacyCleaned = false
  queue = Promise.resolve()
}
