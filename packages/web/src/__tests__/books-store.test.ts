/**
 * Books store — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { apiError, makeBook, makeBookList, response } from './helpers'

const mockFetchBooks  = vi.fn()
const mockGetBook     = vi.fn()
const mockRelated     = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    books: {
      ...actual.books,
      fetchBooks:   (...a: unknown[]) => mockFetchBooks(...a),
      getBook:      (...a: unknown[]) => mockGetBook(...a),
      relatedBooks: (...a: unknown[]) => mockRelated(...a),
    },
  }
})

import { useBooksStore } from '../stores/books'

describe('books store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts empty', () => {
    const store = useBooksStore()
    expect(store.list).toEqual([])
    expect(store.detail).toBeNull()
    expect(store.loading).toBe(false)
  })

  describe('fetchBooks()', () => {
    it('passes server-side filters and stores the page', async () => {
      mockFetchBooks.mockReturnValueOnce(response(makeBookList([makeBook({ id: 1 }), makeBook({ id: 2 })])))
      const store = useBooksStore()
      await store.fetchBooks({ page: 2, limit: 18, category: 5, sort: 'popular' })
      expect(mockFetchBooks).toHaveBeenCalledWith({ page: 2, limit: 18, category: 5, sort: 'popular' })
      expect(store.list).toHaveLength(2)
      expect(store.total).toBe(2)
      expect(store.pagination?.total_pages).toBe(1)
      expect(store.loading).toBe(false)
    })

    it('ignores responses of superseded requests', async () => {
      let resolveSlow: (v: unknown) => void = () => {}
      mockFetchBooks
        .mockReturnValueOnce(new Promise((r) => { resolveSlow = r }))
        .mockReturnValueOnce(response(makeBookList([makeBook({ id: 2 })])))
      const store = useBooksStore()
      const slow = store.fetchBooks({ category: 1 })
      await store.fetchBooks({ category: 2 })
      resolveSlow({ data: makeBookList([makeBook({ id: 1 })]) })
      await slow
      expect(store.list.map((b) => b.id)).toEqual([2])
    })
  })

  describe('fetchDetail()', () => {
    it('stores the book with its access decision', async () => {
      mockGetBook.mockReturnValueOnce(response({ status: 'ok', book: makeBook({ id: 5, access: { granted: false, reason: 'login_required' } }) }))
      const store = useBooksStore()
      await store.fetchDetail(5)
      expect(mockGetBook).toHaveBeenCalledWith(5)
      expect(store.detail?.access.reason).toBe('login_required')
    })

    it('sets detail to null and records the error code on failure', async () => {
      mockGetBook.mockRejectedValueOnce(apiError(404, 'NOT_FOUND'))
      const store = useBooksStore()
      await store.fetchDetail(999)
      expect(store.detail).toBeNull()
      expect(store.detailError).toBe('NOT_FOUND')
    })
  })

  describe('fetchRelated()', () => {
    it('populates related books without the current one', async () => {
      mockRelated.mockReturnValueOnce(response(makeBookList([makeBook({ id: 1 }), makeBook({ id: 3 })])))
      const store = useBooksStore()
      await store.fetchRelated(1)
      expect(store.related.map((b) => b.id)).toEqual([3])
    })
  })

  it('setInLibrary() updates the detail flag', async () => {
    mockGetBook.mockReturnValueOnce(response({ status: 'ok', book: makeBook({ in_library: false }) }))
    const store = useBooksStore()
    await store.fetchDetail(7)
    store.setInLibrary(true)
    expect(store.detail?.in_library).toBe(true)
  })
})
