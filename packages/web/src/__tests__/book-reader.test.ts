/**
 * Reader — the file URL always comes from `books.getFileUrl` (short-lived signed
 * URL), never from the book object; expired URLs are re-requested once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { apiError, makeBook, mountWithApp, response } from './helpers'

const mockGetBook = vi.fn()
const mockGetFileUrl = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    books: {
      ...actual.books,
      getBook: (...a: unknown[]) => mockGetBook(...a),
      getFileUrl: (...a: unknown[]) => mockGetFileUrl(...a),
      updateTotalViews: () => Promise.resolve({ data: undefined }),
    },
  }
})

vi.mock('@/components/shared/EpubReader.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'EpubReader',
      props: ['url', 'bookId', 'refreshUrl'],
      setup: (p) => () => h('div', { 'data-testid': 'epub-stub', 'data-url': p.url, 'data-book-id': p.bookId }),
    }),
  }
})

vi.mock('vue3-pdf-app/dist/icons/main.css', () => ({}))
vi.mock('vue3-pdf-app', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'VuePdfApp',
      props: ['pdf', 'config'],
      setup: (p) => () => h('div', { 'data-testid': 'pdf-stub', 'data-bytes': (p.pdf as ArrayBuffer | undefined)?.byteLength }),
    }),
  }
})

import BookReaderPage from '@/pages/BookReaderPage.vue'
import { useBookFile } from '@/composables/useBookFile'

const inOneHour = () => new Date(Date.now() + 3_600_000).toISOString()
const signed = (format: 'pdf' | 'epub', url: string, expires_at = inOneHour()) =>
  response({ status: 'ok', format, url, expires_at })

describe('BookReaderPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    // The book object carries no file URL at all.
    mockGetBook.mockReturnValue(response({ status: 'ok', book: makeBook() }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests a signed EPUB URL and hands it to the EPUB reader with the book id', async () => {
    mockGetFileUrl.mockReturnValue(signed('epub', 'https://storage.loikmon.org/books/7.epub?X-Amz-Signature=one'))

    const { wrapper } = await mountWithApp(BookReaderPage, { props: { id: '7' }, path: '/books/7/read?format=epub' })
    await vi.waitFor(() => expect(wrapper.find('[data-testid="epub-stub"]').exists()).toBe(true))

    expect(mockGetFileUrl).toHaveBeenCalledWith('7', 'epub')
    const stub = wrapper.find('[data-testid="epub-stub"]')
    expect(stub.attributes('data-url')).toBe('https://storage.loikmon.org/books/7.epub?X-Amz-Signature=one')
    expect(stub.attributes('data-book-id')).toBe('7')
    wrapper.unmount()
  })

  it('lets the server pick the format when none is requested', async () => {
    mockGetFileUrl.mockReturnValue(signed('epub', 'https://storage.loikmon.org/books/7.epub?sig=auto'))

    const { wrapper } = await mountWithApp(BookReaderPage, { props: { id: '7' }, path: '/books/7/read' })
    await vi.waitFor(() => expect(wrapper.find('[data-testid="epub-stub"]').exists()).toBe(true))

    expect(mockGetFileUrl).toHaveBeenCalledWith('7', undefined)
    wrapper.unmount()
  })

  it('downloads the PDF through the signed URL and re-requests it once when storage answers 403', async () => {
    mockGetFileUrl
      .mockReturnValueOnce(signed('pdf', 'https://storage.loikmon.org/books/7.pdf?sig=expired'))
      .mockReturnValueOnce(signed('pdf', 'https://storage.loikmon.org/books/7.pdf?sig=fresh'))
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('expired')
        ? { ok: false, status: 403, arrayBuffer: async () => new ArrayBuffer(0) }
        : { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) },
    )
    vi.stubGlobal('fetch', fetchMock)

    const { wrapper } = await mountWithApp(BookReaderPage, { props: { id: '7' }, path: '/books/7/read?format=pdf' })
    await vi.waitFor(() => expect(wrapper.find('[data-testid="pdf-stub"]').exists()).toBe(true))

    expect(mockGetFileUrl).toHaveBeenCalledTimes(2)
    expect(mockGetFileUrl).toHaveBeenNthCalledWith(2, '7', 'pdf')
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://storage.loikmon.org/books/7.pdf?sig=expired',
      'https://storage.loikmon.org/books/7.pdf?sig=fresh',
    ])
    expect(wrapper.find('[data-testid="pdf-stub"]').attributes('data-bytes')).toBe('16')
    wrapper.unmount()
  })

  it('shows "not available" when the book has no file in that format', async () => {
    mockGetFileUrl.mockRejectedValue(apiError(404, 'NOT_FOUND', 'PDF file for this book not found'))

    const { wrapper } = await mountWithApp(BookReaderPage, { props: { id: '7' }, path: '/books/7/read?format=pdf' })
    await flushPromises()

    expect(wrapper.find('[data-testid="reader-not-available"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('useBookFile', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('re-requests only once: a second 403 is an error', async () => {
    mockGetFileUrl
      .mockReturnValueOnce(signed('pdf', 'https://s/a'))
      .mockReturnValueOnce(signed('pdf', 'https://s/b'))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, arrayBuffer: async () => new ArrayBuffer(0) })))

    const file = useBookFile('9')
    await file.request('pdf')
    await expect(file.fetchBytes()).rejects.toThrow('403')
    expect(mockGetFileUrl).toHaveBeenCalledTimes(2)
  })

  it('refreshes proactively when the signed URL has already expired', async () => {
    mockGetFileUrl
      .mockReturnValueOnce(signed('pdf', 'https://s/old', new Date(Date.now() - 1000).toISOString()))
      .mockReturnValueOnce(signed('pdf', 'https://s/new'))
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) }))
    vi.stubGlobal('fetch', fetchMock)

    const file = useBookFile('9')
    await file.request('pdf')
    const bytes = await file.fetchBytes()

    expect(bytes.byteLength).toBe(4)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]).toContain('https://s/new')
  })

  it('surfaces a lost subscription as a lock reason when re-requesting', async () => {
    mockGetFileUrl
      .mockReturnValueOnce(signed('epub', 'https://s/a'))
      .mockRejectedValueOnce(apiError(403, 'SUBSCRIPTION_REQUIRED'))

    const file = useBookFile('9')
    await file.request('epub')
    await expect(file.refresh()).resolves.toBeNull()
    expect(file.lockReason.value).toBe('subscription_required')
  })
})
