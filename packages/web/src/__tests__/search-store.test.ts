/**
 * Search store — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockSearch = vi.fn()

vi.mock('@loikmon/api', () => ({
  search: {
    search: (...a: unknown[]) => mockSearch(...a),
  },
}))

import { useSearchStore } from '../stores/search'

describe('search store', () => {

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('results start null', () => {
    const store = useSearchStore()
    expect(store.results).toBeNull()
  })

  it('query starts empty', () => {
    const store = useSearchStore()
    expect(store.query).toBe('')
  })

  // ── search() ───────────────────────────────────────────────────────────────
  describe('search()', () => {
    it('populates results with books + articles', async () => {
      const books    = [{ id: 1, title: 'Mon Poetry' }]
      const articles = [{ id: 10, title: 'Mon News' }]
      mockSearch
        .mockResolvedValueOnce({ data: { search: books } })     // type=0 books
        .mockResolvedValueOnce({ data: { search: articles } })  // type=1 articles
      const store = useSearchStore()
      await store.search('mon')
      expect(store.results!.books).toHaveLength(1)
      expect(store.results!.articles).toHaveLength(1)
      expect(store.results!.books[0].title).toBe('Mon Poetry')
    })

    it('fires two parallel calls: type=0 + type=1', async () => {
      mockSearch.mockResolvedValue({ data: { search: [] } })
      const store = useSearchStore()
      await store.search('test')
      expect(mockSearch).toHaveBeenCalledTimes(2)
      expect(mockSearch).toHaveBeenCalledWith('test', 0, 0)
      expect(mockSearch).toHaveBeenCalledWith('test', 1, 0)
    })

    it('does NOT call API for blank/whitespace query', async () => {
      const store = useSearchStore()
      await store.search('   ')
      expect(mockSearch).not.toHaveBeenCalled()
      expect(store.results).toBeNull()
    })

    it('sets query to trimmed value', async () => {
      mockSearch.mockResolvedValue({ data: { search: [] } })
      const store = useSearchStore()
      await store.search('mon poetry')
      expect(store.query).toBe('mon poetry')
    })

    it('loading is false after search', async () => {
      mockSearch.mockResolvedValue({ data: { search: [] } })
      const store = useSearchStore()
      await store.search('q')
      expect(store.loading).toBe(false)
    })

    it('handles missing search key gracefully', async () => {
      mockSearch.mockResolvedValue({ data: {} })
      const store = useSearchStore()
      await store.search('q')
      expect(store.results!.books).toEqual([])
      expect(store.results!.articles).toEqual([])
    })
  })

  // ── clear() ────────────────────────────────────────────────────────────────
  describe('clear()', () => {
    it('resets results and query', async () => {
      mockSearch.mockResolvedValue({ data: { search: [] } })
      const store = useSearchStore()
      await store.search('mon')
      store.clear()
      expect(store.results).toBeNull()
      expect(store.query).toBe('')
    })
  })
})
