import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Article } from '@loikmon/api'

const mockFetchArticles = vi.fn()

vi.mock('@loikmon/api', () => ({
  articles: {
    fetchArticles: (...a: unknown[]) => mockFetchArticles(...a),
    getArticle: vi.fn(),
  },
}))

import {
  compareArticlesByDate,
  getArticleDateTimestamp,
  useArticlesList,
} from '../composables/useArticlesList'

function article(id: number, title: string, articledate?: string): Article {
  return { id, title, articledate }
}

describe('useArticlesList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('sorts articles by date across all fetched API pages', async () => {
    const pages: Record<number, Article[]> = {
      0: [
        article(324, 'June article', '2025-06-27 12:00:00'),
        article(322, 'May article', '2025-05-29 09:01:29'),
      ],
      1: [
        article(351, 'How King Richard Met Robin Hood', '2026-05-04 20:23:41'),
        article(273, 'Older article', '2024-09-19 18:56:11'),
      ],
      2: [],
    }

    mockFetchArticles.mockImplementation((params: Record<string, unknown>) =>
      Promise.resolve({ data: { articles: pages[params.page as number] ?? [] } }),
    )

    const list = useArticlesList()
    await list.fetchPage()

    expect(mockFetchArticles).toHaveBeenCalledTimes(3)
    expect(list.articles.value.map((a) => a.id)).toEqual([351, 324, 322, 273])

    list.toggleSort()

    expect(list.articles.value.map((a) => a.id)).toEqual([273, 322, 324, 351])
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
    const pages: Record<number, Article[]> = {
      0: [article(1, 'Old', '2024-01-01'), article(2, 'Middle', '2025-01-01')],
      1: [article(3, 'New', '2026-01-01')],
      2: [],
    }

    mockFetchArticles.mockImplementation((params: Record<string, unknown>) =>
      Promise.resolve({ data: { articles: pages[params.page as number] ?? [] } }),
    )

    const list = useArticlesList()
    await list.fetchPage()

    list.changePageSize(2)
    expect(list.articles.value.map((a) => a.id)).toEqual([3, 2])
    expect(list.totalPages.value).toBe(2)
    expect(list.isLastPage.value).toBe(false)

    list.goToPage(2)
    expect(list.articles.value.map((a) => a.id)).toEqual([1])
    expect(list.isLastPage.value).toBe(true)
  })
})