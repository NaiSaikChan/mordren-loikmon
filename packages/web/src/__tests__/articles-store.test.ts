/**
 * Articles store — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockFetchArticles = vi.fn()
const mockGetArticle    = vi.fn()

vi.mock('@loikmon/api', () => ({
  articles: {
    fetchArticles: (...a: unknown[]) => mockFetchArticles(...a),
    getArticle:    (...a: unknown[]) => mockGetArticle(...a),
  },
}))

import { useArticlesStore } from '../stores/articles'

const ARTICLE_LIST = [
  { id: 1, title: 'Mon News A', cat: 'news' },
  { id: 2, title: 'Mon News B', cat: 'culture' },
]

describe('articles store', () => {

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('list starts empty', () => {
    const store = useArticlesStore()
    expect(store.list).toEqual([])
  })

  it('detail starts null', () => {
    const store = useArticlesStore()
    expect(store.detail).toBeNull()
  })

  // ── fetchArticles() ────────────────────────────────────────────────────────
  describe('fetchArticles()', () => {
    it('populates list from articles array', async () => {
      mockFetchArticles.mockResolvedValueOnce({ data: { articles: ARTICLE_LIST } })
      const store = useArticlesStore()
      await store.fetchArticles()
      expect(store.list).toHaveLength(2)
      expect(store.list[0].title).toBe('Mon News A')
    })

    it('handles top-level array response', async () => {
      mockFetchArticles.mockResolvedValueOnce({ data: ARTICLE_LIST })
      const store = useArticlesStore()
      await store.fetchArticles()
      expect(store.list).toHaveLength(2)
    })

    it('loading is false after fetch', async () => {
      mockFetchArticles.mockResolvedValueOnce({ data: { articles: [] } })
      const store = useArticlesStore()
      await store.fetchArticles()
      expect(store.loading).toBe(false)
    })
  })

  // ── fetchDetail() ─────────────────────────────────────────────────────────
  describe('fetchDetail()', () => {
    it('returns from list cache when article is already loaded', async () => {
      mockFetchArticles.mockResolvedValueOnce({ data: { articles: ARTICLE_LIST } })
      const store = useArticlesStore()
      await store.fetchArticles()
      await store.fetchDetail(1)
      // Should not have called getArticle — found in cache
      expect(mockGetArticle).not.toHaveBeenCalled()
      expect(store.detail!.title).toBe('Mon News A')
    })

    it('calls API when not in cache', async () => {
      const article = { id: 99, title: 'Remote Article' }
      mockGetArticle.mockResolvedValueOnce({ data: { article } })
      const store = useArticlesStore()
      await store.fetchDetail(99)
      expect(mockGetArticle).toHaveBeenCalledWith(99)
      expect(store.detail!.title).toBe('Remote Article')
    })

    it('handles nested data.article response', async () => {
      const article = { id: 50, title: 'Nested Article' }
      mockGetArticle.mockResolvedValueOnce({ data: { data: { article } } })
      const store = useArticlesStore()
      await store.fetchDetail(50)
      expect(store.detail!.title).toBe('Nested Article')
    })
  })
})
