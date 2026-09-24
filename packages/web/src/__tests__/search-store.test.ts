/**
 * Search store — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { makeArticle, makeBook, response } from './helpers'

const mockSearch = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return { ...actual, search: { search: (...a: unknown[]) => mockSearch(...a) } }
})

import { useSearchStore } from '../stores/search'

const results = (overrides = {}) => ({
  status: 'ok', query: 'mon', books: [], articles: [], authors: [], totals: { books: 0, articles: 0, authors: 0 }, ...overrides,
})

describe('search store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts empty', () => {
    const store = useSearchStore()
    expect(store.results).toBeNull()
    expect(store.query).toBe('')
  })

  it('makes one request for books, articles and authors', async () => {
    mockSearch.mockReturnValueOnce(response(results({ books: [makeBook({ title: 'Mon Poetry' })], articles: [makeArticle()], authors: [] })))
    const store = useSearchStore()
    await store.search('  mon  ')
    expect(mockSearch).toHaveBeenCalledTimes(1)
    expect(mockSearch).toHaveBeenCalledWith('mon', { type: 'all', limit: 20 })
    expect(store.query).toBe('mon')
    expect(store.results!.books[0].title).toBe('Mon Poetry')
    expect(store.results!.articles).toHaveLength(1)
    expect(store.loading).toBe(false)
  })

  it('does NOT call the API for a blank query', async () => {
    const store = useSearchStore()
    await store.search('   ')
    expect(mockSearch).not.toHaveBeenCalled()
    expect(store.results).toBeNull()
  })

  it('handles missing arrays gracefully', async () => {
    mockSearch.mockReturnValueOnce(response({ status: 'ok' }))
    const store = useSearchStore()
    await store.search('q')
    expect(store.results!.books).toEqual([])
    expect(store.results!.authors).toEqual([])
  })

  it('clear() resets results and query', async () => {
    mockSearch.mockReturnValueOnce(response(results()))
    const store = useSearchStore()
    await store.search('mon')
    store.clear()
    expect(store.results).toBeNull()
    expect(store.query).toBe('')
  })
})
