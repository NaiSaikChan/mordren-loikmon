import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Article, ArticleQuery } from '@loikmon/api'
import { makeArticle } from './helpers'

const mockFetchArticles = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    articles: {
      ...actual.articles,
      fetchArticles: (...a: unknown[]) => mockFetchArticles(...a),
    },
  }
})

import {
  API_PAGE_SIZE,
  clearArticleListCache,
  compareArticlesByDate,
  getArticleDateTimestamp,
  useArticlesList,
} from '../composables/useArticlesList'

function article(id: number, title: string, articledate?: string): Article {
  return makeArticle({ id, title, articledate: articledate ?? null, published_at: null })
}

/** Serves 1-based pages; `has_more` is true while a later page exists. */
function servePages(pages: Record<number, Article[]>) {
  const last = Math.max(...Object.keys(pages).map(Number))
  mockFetchArticles.mockImplementation((params: ArticleQuery) => {
    const page = params.page ?? 1
    const items = pages[page] ?? []
    return Promise.resolve({
      data: {
        status: 'ok',
        articles: items,
        total: Object.values(pages).flat().length,
        pagination: { page, limit: params.limit, total: 0, total_pages: last, has_more: page < last },
      },
    })
  })
}

describe('useArticlesList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    clearArticleListCache()
  })

  it('sorts articles by date across all fetched API pages', async () => {
    servePages({
      1: [
        article(324, 'June article', '2025-06-27 12:00:00'),
        article(322, 'May article', '2025-05-29 09:01:29'),
      ],
      2: [
        article(351, 'How King Richard Met Robin Hood', '2026-05-04 20:23:41'),
        article(273, 'Older article', '2024-09-19 18:56:11'),
      ],
    })

    const list = useArticlesList()
    await list.fetchPage()

    await vi.waitFor(() => expect(list.articles.value).toHaveLength(4))
    expect(list.articles.value.map((a) => a.id)).toEqual([351, 324, 322, 273])

    list.toggleSort()

    expect(list.articles.value.map((a) => a.id)).toEqual([273, 322, 324, 351])
  })

  it('requests 1-based pages and stops when pagination.has_more is false', async () => {
    servePages({
      1: [article(1, 'A', '2026-01-03')],
      2: [article(2, 'B', '2026-01-02')],
      3: [article(3, 'C', '2026-01-01')],
    })

    const list = useArticlesList()
    await list.fetchPage()
    await vi.waitFor(() => expect(list.articles.value).toHaveLength(3))
    await new Promise((r) => setTimeout(r, 10))

    expect(mockFetchArticles).toHaveBeenCalledTimes(3)
    expect(mockFetchArticles.mock.calls.map((c) => (c[0] as ArticleQuery).page)).toEqual([1, 2, 3])
    expect(mockFetchArticles.mock.calls[0][0]).toEqual({ page: 1, limit: API_PAGE_SIZE, sort: 'latest' })
  })

  it('does not request a second page when the first has no more pages', async () => {
    servePages({ 1: [article(1, 'Only', '2026-01-01')] })

    const list = useArticlesList()
    await list.fetchPage()
    await new Promise((r) => setTimeout(r, 10))

    expect(mockFetchArticles).toHaveBeenCalledTimes(1)
    expect(list.articles.value.map((a) => a.id)).toEqual([1])
  })

  it('renders the first page before loading the remaining cache pages', async () => {
    servePages({ 1: [article(1, 'First page')], 2: [article(2, 'Later page')] })

    const list = useArticlesList()
    await list.fetchPage()

    expect(mockFetchArticles).toHaveBeenCalledTimes(1)
    expect(list.articles.value.map((a) => a.id)).toEqual([1])
    await vi.waitFor(() => expect(mockFetchArticles).toHaveBeenCalledTimes(2))
  })

  it('passes the category to the server (no client-side filtering) and caches per category', async () => {
    servePages({ 1: [article(5, 'Culture', '2026-01-01')] })

    const list = useArticlesList()
    await list.changeCategory(4)
    expect(mockFetchArticles).toHaveBeenLastCalledWith({ page: 1, limit: API_PAGE_SIZE, sort: 'latest', category: 4 })

    await list.changeCategory(0)
    expect(mockFetchArticles).toHaveBeenCalledTimes(2)
    expect(mockFetchArticles.mock.calls[1][0]).not.toHaveProperty('category')

    // Back to the cached category: no request.
    await list.changeCategory(4)
    expect(mockFetchArticles).toHaveBeenCalledTimes(2)
    expect(list.articles.value.map((a) => a.id)).toEqual([5])
  })

  it('reuses cached article data for the same category instead of refetching', async () => {
    servePages({ 1: [article(10, 'First', '2026-01-01'), article(20, 'Second', '2025-01-01')] })

    const firstList = useArticlesList()
    await firstList.fetchPage()
    const callsAfterFirstLoad = mockFetchArticles.mock.calls.length

    const secondList = useArticlesList()
    await secondList.fetchPage()
    expect(mockFetchArticles).toHaveBeenCalledTimes(callsAfterFirstLoad)
    expect(secondList.articles.value.map((a) => a.id)).toEqual([10, 20])
  })

  it('keeps invalid or missing dates last in both sort directions', () => {
    const valid = article(1, 'Valid date', '2026-01-01 00:00:00')
    const invalid = article(2, 'Invalid date', 'not-a-date')
    const missing = article(3, 'Missing date')

    expect(getArticleDateTimestamp(valid)).toBeGreaterThan(0)
    expect(getArticleDateTimestamp(invalid)).toBeNull()
    expect(getArticleDateTimestamp(missing)).toBeNull()

    expect([invalid, valid].sort((a, b) => compareArticlesByDate(a, b, 'desc'))).toEqual([valid, invalid])
    expect([missing, valid].sort((a, b) => compareArticlesByDate(a, b, 'asc'))).toEqual([valid, missing])
  })

  it('paginates locally after globally sorting fetched articles', async () => {
    servePages({
      1: [article(1, 'Old', '2024-01-01'), article(2, 'Middle', '2025-01-01')],
      2: [article(3, 'New', '2026-01-01')],
    })

    const list = useArticlesList()
    await list.fetchPage()
    await vi.waitFor(() => expect(list.articles.value).toHaveLength(3))

    list.changePageSize(2)
    expect(list.articles.value.map((a) => a.id)).toEqual([3, 2])
    expect(list.totalPages.value).toBe(2)
    expect(list.isLastPage.value).toBe(false)

    list.goToPage(2)
    expect(list.articles.value.map((a) => a.id)).toEqual([1])
    expect(list.isLastPage.value).toBe(true)
  })

  it('flags an error when the first page fails', async () => {
    mockFetchArticles.mockRejectedValue(new Error('network'))
    const list = useArticlesList()
    await list.fetchPage()
    expect(list.error.value).toBe(true)
    expect(list.loading.value).toBe(false)
  })
})
