/**
 * Books store — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockFetchBooks  = vi.fn()
const mockGetItem     = vi.fn()
const mockGetChapters = vi.fn()
const mockRelated     = vi.fn()
const mockRateBook    = vi.fn()

vi.mock('@loikmon/api', () => ({
  books: {
    fetchBooks:   (...a: unknown[]) => mockFetchBooks(...a),
    getItem:      (...a: unknown[]) => mockGetItem(...a),
    getChapters:  (...a: unknown[]) => mockGetChapters(...a),
    relatedBooks: (...a: unknown[]) => mockRelated(...a),
    rateBook:     (...a: unknown[]) => mockRateBook(...a),
  },
}))

import { useBooksStore } from '../stores/books'

const BOOK_LIST = [
  { id: 1, title: 'Mon Book A', thumbnail: '/thumb1.jpg' },
  { id: 2, title: 'Mon Book B', thumbnail: '/thumb2.jpg' },
]

describe('books store', () => {

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── initial state ──────────────────────────────────────────────────────────
  it('list starts empty', () => {
    const store = useBooksStore()
    expect(store.list).toEqual([])
  })

  it('detail starts null', () => {
    const store = useBooksStore()
    expect(store.detail).toBeNull()
  })

  it('loading starts false', () => {
    const store = useBooksStore()
    expect(store.loading).toBe(false)
  })

  // ── fetchBooks() ───────────────────────────────────────────────────────────
  describe('fetchBooks()', () => {
    it('populates list from books array in response', async () => {
      mockFetchBooks.mockResolvedValueOnce({ data: { books: BOOK_LIST } })
      const store = useBooksStore()
      await store.fetchBooks()
      expect(store.list).toHaveLength(2)
      expect(store.list[0].title).toBe('Mon Book A')
    })

    it('handles top-level array response', async () => {
      mockFetchBooks.mockResolvedValueOnce({ data: BOOK_LIST })
      const store = useBooksStore()
      await store.fetchBooks()
      expect(store.list).toHaveLength(2)
    })

    it('sets list to [] when response is empty', async () => {
      mockFetchBooks.mockResolvedValueOnce({ data: { books: [] } })
      const store = useBooksStore()
      await store.fetchBooks()
      expect(store.list).toEqual([])
    })

    it('loading is false after fetch', async () => {
      mockFetchBooks.mockResolvedValueOnce({ data: { books: [] } })
      const store = useBooksStore()
      await store.fetchBooks()
      expect(store.loading).toBe(false)
    })

    it('passes params to API', async () => {
      mockFetchBooks.mockResolvedValueOnce({ data: { books: [] } })
      const store = useBooksStore()
      await store.fetchBooks({ cat: 'poetry', offset: 10 })
      expect(mockFetchBooks).toHaveBeenCalledWith({ cat: 'poetry', offset: 10 })
    })
  })

  // ── fetchDetail() ──────────────────────────────────────────────────────────
  describe('fetchDetail()', () => {
    it('sets detail from body.book', async () => {
      const book = { id: 5, title: 'Detail Book' }
      mockGetItem.mockResolvedValueOnce({ data: { book } })
      const store = useBooksStore()
      await store.fetchDetail(5)
      expect(store.detail!.title).toBe('Detail Book')
    })

    it('sets detail from body.data.book (nested)', async () => {
      const book = { id: 6, title: 'Nested Book' }
      mockGetItem.mockResolvedValueOnce({ data: { data: { book } } })
      const store = useBooksStore()
      await store.fetchDetail(6)
      expect(store.detail!.title).toBe('Nested Book')
    })

    it('sets detail to null when book not found', async () => {
      mockGetItem.mockResolvedValueOnce({ data: {} })
      const store = useBooksStore()
      await store.fetchDetail(999)
      expect(store.detail).toBeNull()
    })
  })

  // ── fetchChapters() ────────────────────────────────────────────────────────
  describe('fetchChapters()', () => {
    it('populates chapters', async () => {
      const chapters = [{ id: 1, title: 'Chapter 1' }, { id: 2, title: 'Chapter 2' }]
      mockGetChapters.mockResolvedValueOnce({ data: { chapters } })
      const store = useBooksStore()
      await store.fetchChapters(1)
      expect(store.chapters).toHaveLength(2)
    })

    it('handles empty chapters', async () => {
      mockGetChapters.mockResolvedValueOnce({ data: { chapters: [] } })
      const store = useBooksStore()
      await store.fetchChapters(1)
      expect(store.chapters).toEqual([])
    })
  })

  // ── fetchRelated() ────────────────────────────────────────────────────────
  describe('fetchRelated()', () => {
    it('populates related books', async () => {
      mockRelated.mockResolvedValueOnce({ data: { books: BOOK_LIST } })
      const store = useBooksStore()
      await store.fetchRelated(1)
      expect(store.related).toHaveLength(2)
    })
  })

  // ── rateBook() ────────────────────────────────────────────────────────────
  describe('rateBook()', () => {
    it('calls API with bookId and rating', async () => {
      mockRateBook.mockResolvedValueOnce({ data: { status: 'ok' } })
      const store = useBooksStore()
      await store.rateBook(5, 4)
      expect(mockRateBook).toHaveBeenCalledWith(5, 4)
    })
  })
})
