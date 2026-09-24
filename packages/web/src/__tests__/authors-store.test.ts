/**
 * Authors store — pagination, detail (with books/articles) and follow toggle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Author } from '@loikmon/api'
import { apiError, makeArticle, makeBook, response } from './helpers'

const mockFetchAuthors   = vi.fn()
const mockGetAuthor      = vi.fn()
const mockFollowUnfollow = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    authors: {
      ...actual.authors,
      fetchAuthors:   (...a: unknown[]) => mockFetchAuthors(...a),
      getAuthor:      (...a: unknown[]) => mockGetAuthor(...a),
      followUnfollow: (...a: unknown[]) => mockFollowUnfollow(...a),
    },
  }
})

import { useAuthorsStore } from '../stores/authors'

const makeAuthor = (id: number, overrides: Partial<Author> = {}): Author => ({
  id, name: `Author ${id}`, bio: '', description: '', thumbnail: null, avatar_url: null, website: null, facebook: null,
  youtube: null, instagram: null, verified: false, books_count: id, bookscount: id, articles_count: 0, articlescount: 0,
  followers_count: 0, is_following: false, created_at: null, joined_date: null, ...overrides,
})

const page = (n: number, totalPages = 3) => ({ page: n, limit: 20, total: 60, total_pages: totalPages, has_more: n < totalPages })

describe('authors store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initial state is empty', () => {
    const store = useAuthorsStore()
    expect(store.list).toEqual([])
    expect(store.detail).toBeNull()
    expect(store.loading).toBe(false)
  })

  describe('fetchAuthors()', () => {
    it('replaces the list with the requested 1-based page', async () => {
      mockFetchAuthors.mockReturnValue(response({ status: 'ok', authors: [makeAuthor(21), makeAuthor(22)], total: 60, pagination: page(2) }))
      const store = useAuthorsStore()
      store.list = [makeAuthor(1)]
      await store.fetchAuthors({ page: 2, limit: 20 })
      expect(mockFetchAuthors).toHaveBeenCalledWith({ page: 2, limit: 20 })
      expect(store.list.map((a) => a.id)).toEqual([21, 22])
      expect(store.pagination?.total_pages).toBe(3)
    })

    it('sets loading false after error', async () => {
      mockFetchAuthors.mockRejectedValue(new Error('network'))
      const store = useAuthorsStore()
      await store.fetchAuthors().catch(() => {})
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchDetail()', () => {
    it('stores the author with their books and articles', async () => {
      mockGetAuthor.mockReturnValue(response({ status: 'ok', author: makeAuthor(7), books: [makeBook()], articles: [makeArticle()] }))
      const store = useAuthorsStore()
      await store.fetchDetail(7)
      expect(mockGetAuthor).toHaveBeenCalledWith(7)
      expect(store.detail?.id).toBe(7)
      expect(store.books).toHaveLength(1)
      expect(store.articles).toHaveLength(1)
    })

    it('clears the detail when the author is missing', async () => {
      mockGetAuthor.mockRejectedValue(apiError(404, 'NOT_FOUND'))
      const store = useAuthorsStore()
      await store.fetchDetail(99)
      expect(store.detail).toBeNull()
      expect(store.detailError).toBe('NOT_FOUND')
    })
  })

  describe('toggleFollow()', () => {
    it('follows when not following and applies the server counts', async () => {
      mockFollowUnfollow.mockReturnValue(response({ status: 'ok', is_following: true, followers_count: 11 }))
      const store = useAuthorsStore()
      store.detail = makeAuthor(5, { is_following: false, followers_count: 10 })

      await expect(store.toggleFollow(5)).resolves.toBe(true)

      expect(mockFollowUnfollow).toHaveBeenCalledWith(5, false)
      expect(store.detail?.is_following).toBe(true)
      expect(store.detail?.followers_count).toBe(11)
    })

    it('unfollows when already following (list item)', async () => {
      mockFollowUnfollow.mockReturnValue(response({ status: 'ok', is_following: false, followers_count: 0 }))
      const store = useAuthorsStore()
      store.list = [makeAuthor(8, { is_following: true, followers_count: 1 })]

      await store.toggleFollow(8)

      expect(mockFollowUnfollow).toHaveBeenCalledWith(8, true)
      expect(store.list[0].is_following).toBe(false)
    })
  })
})
