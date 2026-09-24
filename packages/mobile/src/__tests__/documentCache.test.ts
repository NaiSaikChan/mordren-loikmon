import { Platform } from 'react-native'
import {
  DownloadCancelledError,
  HttpStatusError,
  __resetForTests,
  documentCacheKey,
  getCachedDocument,
  isEntryFresh,
  resolveDocument,
  safeFileName,
  selectEvictions,
  type CacheEntry,
} from '@/lib/documentCache'

/* In-memory stand-ins for expo-file-system and AsyncStorage-backed storage. */
const mockFiles = new Map<string, number>()
const mockStore = new Map<string, unknown>()
const mockDownloads: {
  url: string
  dest: string
  status?: number
  size?: number
  headers?: Record<string, string>
}[] = []
let mockNextDownload: { status: number; size: number; headers?: Record<string, string> } = {
  status: 200,
  size: 100,
  headers: { ETag: '"v1"' },
}

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(async (uri: string) => {
    if (uri.endsWith('/')) return { exists: true, isDirectory: true, uri }
    const size = mockFiles.get(uri)
    return size == null ? { exists: false, uri } : { exists: true, size, uri, isDirectory: false }
  }),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async (uri: string) => {
    mockFiles.delete(uri)
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const size = mockFiles.get(from)
    if (size == null) throw new Error('missing ' + from)
    mockFiles.delete(from)
    mockFiles.set(to, size)
  }),
  createDownloadResumable: jest.fn(
    (url: string, dest: string, _opts: unknown, onProgress?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void) => ({
      cancelAsync: jest.fn(async () => undefined),
      downloadAsync: jest.fn(async () => {
        const next = mockNextDownload
        mockDownloads.push({ url, dest, ...next })
        onProgress?.({ totalBytesWritten: next.size / 2, totalBytesExpectedToWrite: next.size })
        onProgress?.({ totalBytesWritten: next.size, totalBytesExpectedToWrite: next.size })
        mockFiles.set(dest, next.size)
        return { uri: dest, status: next.status, headers: next.headers ?? {}, mimeType: null }
      }),
    }),
  ),
}))

jest.mock('@/services/storage', () => ({
  storage: {
    getJSON: jest.fn(async (key: string) => (mockStore.has(key) ? JSON.parse(JSON.stringify(mockStore.get(key))) : null)),
    setJSON: jest.fn(async (key: string, value: unknown) => {
      mockStore.set(key, JSON.parse(JSON.stringify(value)))
    }),
  },
}))


// iOS keeps books in Caches (not iCloud-backed), Android in the documents dir.
const DIR = Platform.OS === 'ios' ? 'file:///cache/documents/' : 'file:///docs/documents/'

beforeEach(() => {
  mockFiles.clear()
  mockStore.clear()
  mockDownloads.length = 0
  mockNextDownload = { status: 200, size: 100, headers: { ETag: '"v1"' } }
  __resetForTests()
})

describe('keys and versioning', () => {
  it('keys by book and format, never by the signed URL', () => {
    expect(documentCacheKey(12, 'epub')).toBe('book-12-epub')
    expect(documentCacheKey('12', 'pdf')).toBe('book-12-pdf')
    expect(safeFileName('book-12/../x?sig=1', 'pdf')).toBe('book-12_.._x_sig_1.pdf')
  })

  it('compares caller versions first, then ETags, and trusts the cache when nothing is comparable', () => {
    expect(isEntryFresh({ version: '2026-01-01', etag: '"a"' }, { version: '2026-01-01' })).toBe(true)
    expect(isEntryFresh({ version: '2026-01-01', etag: '"a"' }, { version: '2026-02-01' })).toBe(false)
    expect(isEntryFresh({ version: null, etag: '"abc"' }, { etag: 'W/"abc"' })).toBe(true)
    expect(isEntryFresh({ version: null, etag: '"abc"' }, { etag: '"def"' })).toBe(false)
    expect(isEntryFresh({ version: null, etag: '"abc"' }, { etag: null })).toBe(true)
    expect(isEntryFresh({ version: null, etag: null }, {})).toBe(true)
  })
})

describe('selectEvictions (LRU)', () => {
  const entry = (key: string, size: number, lastAccess: number): CacheEntry => ({
    key,
    file: `${key}.pdf`,
    version: null,
    etag: null,
    size,
    lastAccess,
  })

  it('evicts nothing under the cap', () => {
    expect(selectEvictions([entry('a', 10, 1), entry('b', 10, 2)], 100)).toEqual([])
  })

  it('evicts least recently used first until under the cap', () => {
    const entries = [entry('new', 40, 30), entry('old', 40, 10), entry('mid', 40, 20)]
    expect(selectEvictions(entries, 80)).toEqual(['old'])
    expect(selectEvictions(entries, 40)).toEqual(['old', 'mid'])
  })

  it('never evicts the book being opened, even if it alone exceeds the cap', () => {
    const entries = [entry('big', 500, 1), entry('other', 10, 2)]
    expect(selectEvictions(entries, 100, 'big')).toEqual(['other'])
  })
})

describe('resolveDocument', () => {
  const base = { key: 'book-1-pdf', ext: 'pdf' as const }

  it('downloads into the platform cache dir once, then serves the cached copy', async () => {
    const first = await resolveDocument({ ...base, url: 'https://s3/x.pdf?sig=1', probe: async () => '"v1"' })
    expect(first).toEqual({ uri: `${DIR}book-1-pdf.pdf`, size: 100, fromCache: false })
    expect(mockFiles.has(`${DIR}book-1-pdf.pdf`)).toBe(true)
    // No temporary `.part` file is left behind.
    expect([...mockFiles.keys()].some((k) => k.endsWith('.part'))).toBe(false)

    const second = await resolveDocument({ ...base, url: 'https://s3/x.pdf?sig=2', probe: async () => '"v1"' })
    expect(second.fromCache).toBe(true)
    expect(mockDownloads).toHaveLength(1)
  })

  it('re-downloads when the ETag changed', async () => {
    await resolveDocument({ ...base, url: 'u1', probe: async () => '"v1"' })
    mockNextDownload = { status: 200, size: 120, headers: { etag: '"v2"' } }
    const next = await resolveDocument({ ...base, url: 'u2', probe: async () => '"v2"' })
    expect(next).toMatchObject({ fromCache: false, size: 120 })
    expect(mockDownloads).toHaveLength(2)
  })

  it('re-downloads when the caller version changed, without probing', async () => {
    const probe = jest.fn(async () => null)
    await resolveDocument({ ...base, url: 'u1', version: '2026-01-01', probe })
    await resolveDocument({ ...base, url: 'u2', version: '2026-01-01', probe })
    expect(mockDownloads).toHaveLength(1)
    await resolveDocument({ ...base, url: 'u3', version: '2026-05-05', probe })
    expect(mockDownloads).toHaveLength(2)
    expect(probe).not.toHaveBeenCalled()
  })

  it('opens the cached copy offline (no URL) and when the probe fails', async () => {
    await resolveDocument({ ...base, url: 'u1', probe: async () => '"v1"' })
    await expect(resolveDocument({ ...base, url: null })).resolves.toMatchObject({ fromCache: true })
    await expect(resolveDocument({ ...base, url: 'u2', probe: async () => null })).resolves.toMatchObject({
      fromCache: true,
    })
    expect(mockDownloads).toHaveLength(1)
  })

  it('fails offline when nothing is cached', async () => {
    await expect(resolveDocument({ ...base, url: null })).rejects.toThrow('Offline and not downloaded')
  })

  it('retries once with a fresh URL when the signed URL expired', async () => {
    mockNextDownload = { status: 403, size: 10 }
    const refreshUrl = jest.fn(async () => {
      mockNextDownload = { status: 200, size: 100, headers: { ETag: '"v1"' } }
      return 'fresh'
    })
    const doc = await resolveDocument({ ...base, url: 'stale', refreshUrl })
    expect(doc.fromCache).toBe(false)
    expect(refreshUrl).toHaveBeenCalledTimes(1)
    expect(mockDownloads.map((d) => d.url)).toEqual(['stale', 'fresh'])
  })

  it('does not commit a failed download', async () => {
    mockNextDownload = { status: 500, size: 10 }
    await expect(resolveDocument({ ...base, url: 'u' })).rejects.toBeInstanceOf(HttpStatusError)
    expect(await getCachedDocument(base.key)).toBeNull()
    expect(mockFiles.size).toBe(0)
  })

  it('keeps an older copy readable when the newer version cannot be downloaded', async () => {
    await resolveDocument({ ...base, url: 'u1', probe: async () => '"v1"' })
    mockNextDownload = { status: 500, size: 10 }
    await expect(resolveDocument({ ...base, url: 'u2', probe: async () => '"v2"' })).resolves.toMatchObject({
      fromCache: true,
    })
  })

  it('reports download progress', async () => {
    const onProgress = jest.fn()
    await resolveDocument({ ...base, url: 'u', onProgress })
    expect(onProgress).toHaveBeenLastCalledWith({ written: 100, total: 100 })
  })

  it('stops when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(resolveDocument({ ...base, url: 'u', signal: controller.signal })).rejects.toBeInstanceOf(
      DownloadCancelledError,
    )
    expect(mockDownloads).toHaveLength(0)
  })

  it('evicts least recently opened books past the size cap', async () => {
    let clock = 1
    const now = () => clock++
    mockNextDownload = { status: 200, size: 60, headers: {} }
    await resolveDocument({ key: 'book-1-pdf', ext: 'pdf', url: 'a', now, maxBytes: 150 })
    await resolveDocument({ key: 'book-2-epub', ext: 'epub', url: 'b', now, maxBytes: 150 })
    // Re-open book 1 so book 2 becomes the least recently used.
    await resolveDocument({ key: 'book-1-pdf', ext: 'pdf', url: 'a', now, maxBytes: 150 })
    await new Promise((r) => setTimeout(r, 0))
    await resolveDocument({ key: 'book-3-pdf', ext: 'pdf', url: 'c', now, maxBytes: 150 })

    expect(await getCachedDocument('book-2-epub')).toBeNull()
    expect(mockFiles.has(`${DIR}book-2-epub.epub`)).toBe(false)
    expect(await getCachedDocument('book-1-pdf')).not.toBeNull()
    expect(await getCachedDocument('book-3-pdf')).not.toBeNull()
  })

  it('forgets an entry whose file disappeared', async () => {
    await resolveDocument({ ...base, url: 'u' })
    mockFiles.clear()
    expect(await getCachedDocument(base.key)).toBeNull()
  })
})
