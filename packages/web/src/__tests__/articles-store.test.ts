/**
 * Articles store — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { apiError, makeArticle, makeArticleDetail, response } from './helpers'

const mockFetchArticles = vi.fn()
const mockGetArticle    = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    articles: {
      ...actual.articles,
      fetchArticles: (...a: unknown[]) => mockFetchArticles(...a),
      getArticle:    (...a: unknown[]) => mockGetArticle(...a),
    },
  }
})

import { useArticlesStore } from '../stores/articles'

const pagination = { page: 1, limit: 20, total: 2, total_pages: 1, has_more: false }

describe('articles store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts empty', () => {
    const store = useArticlesStore()
    expect(store.list).toEqual([])
    expect(store.detail).toBeNull()
  })

  describe('fetchArticles()', () => {
    it('populates list, total and pagination', async () => {
      mockFetchArticles.mockReturnValueOnce(response({ status: 'ok', articles: [makeArticle({ id: 1 }), makeArticle({ id: 2 })], total: 2, pagination }))
      const store = useArticlesStore()
      await store.fetchArticles({ page: 1, category: 4 })
      expect(mockFetchArticles).toHaveBeenCalledWith({ page: 1, category: 4 })
      expect(store.list).toHaveLength(2)
      expect(store.total).toBe(2)
      expect(store.pagination?.has_more).toBe(false)
      expect(store.loading).toBe(false)
    })

    it('appends when asked to', async () => {
      mockFetchArticles
        .mockReturnValueOnce(response({ status: 'ok', articles: [makeArticle({ id: 1 })], total: 2, pagination }))
        .mockReturnValueOnce(response({ status: 'ok', articles: [makeArticle({ id: 2 })], total: 2, pagination }))
      const store = useArticlesStore()
      await store.fetchArticles({ page: 1 })
      await store.fetchArticles({ page: 2 }, true)
      expect(store.list.map((a) => a.id)).toEqual([1, 2])
    })
  })

  describe('fetchDetail()', () => {
    it('always asks the server (list items have no body)', async () => {
      mockFetchArticles.mockReturnValueOnce(response({ status: 'ok', articles: [makeArticle({ id: 11 })], total: 1, pagination }))
      mockGetArticle.mockReturnValueOnce(response({ status: 'ok', article: makeArticleDetail({ id: 11, content: '<p>Body</p>' }) }))
      const store = useArticlesStore()
      await store.fetchArticles()
      await store.fetchDetail(11)
      expect(mockGetArticle).toHaveBeenCalledWith(11)
      expect(store.detail?.content).toBe('<p>Body</p>')
    })

    it('keeps locked articles (content null) as the detail', async () => {
      mockGetArticle.mockReturnValueOnce(response({ status: 'ok', article: makeArticleDetail({ locked: true, content: null }) }))
      const store = useArticlesStore()
      await store.fetchDetail(11)
      expect(store.detail?.locked).toBe(true)
      expect(store.detail?.content).toBeNull()
    })

    it('records the error code when the article cannot be loaded', async () => {
      mockGetArticle.mockRejectedValueOnce(apiError(404, 'NOT_FOUND'))
      const store = useArticlesStore()
      await store.fetchDetail(99)
      expect(store.detail).toBeNull()
      expect(store.detailError).toBe('NOT_FOUND')
    })
  })
})
