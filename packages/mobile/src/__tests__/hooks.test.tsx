/**
 * @jest-environment jsdom
 */
import { createTestQueryClient, flush, renderHook, waitFor } from '@/test-utils/renderHook'
import { act } from 'react'
import { ApiError } from '@loikmon/api'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { useCategoryContent } from '@/hooks/useCategoryContent'
import { useReviews } from '@/hooks/useReviews'
import { useBookDetail } from '@/hooks/useBooks'
import { useSearch } from '@/hooks/useSearch'
import { useCategories } from '@/hooks/useCategories'

const mockGetCategory = jest.fn()
const mockFetchCategories = jest.fn()
const mockLoadReviews = jest.fn()
const mockSubmitReview = jest.fn()
const mockDeleteReview = jest.fn()
const mockGetBook = jest.fn()
const mockRelated = jest.fn()
const mockViews = jest.fn()
const mockSearch = jest.fn()

jest.mock('@loikmon/api', () => ({
  ...jest.requireActual('@loikmon/api'),
  categories: {
    getCategory: (...a: unknown[]) => mockGetCategory(...a),
    fetchCategories: (...a: unknown[]) => mockFetchCategories(...a),
  },
  reviews: {
    loadReviews: (...a: unknown[]) => mockLoadReviews(...a),
    submitReview: (...a: unknown[]) => mockSubmitReview(...a),
    deleteReview: (...a: unknown[]) => mockDeleteReview(...a),
  },
  books: {
    getBook: (...a: unknown[]) => mockGetBook(...a),
    relatedBooks: (...a: unknown[]) => mockRelated(...a),
    updateTotalViews: (...a: unknown[]) => mockViews(...a),
  },
  search: { search: (...a: unknown[]) => mockSearch(...a) },
}))

jest.mock('@/context/AuthContext', () => ({
  ...jest.requireActual('@/context/AuthContext'),
  useAuth: () => ({ user: { id: 'u1', name: 'Reader' } }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockViews.mockResolvedValue(undefined)
})

describe('usePaginatedList', () => {
  it('loads page 1, appends pages, and never double-fetches when loadMore fires twice', async () => {
    const fetchPage = jest.fn(async (page: number) => ({
      items: [{ id: page * 10 + 1 }, { id: page * 10 + 2 }],
      pagination: { has_more: page < 3 },
    }))
    const { result } = await renderHook(() => usePaginatedList('test:list', fetchPage))
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.loading).toBe(false)

    await act(async () => {
      void result.current.loadMore()
      void result.current.loadMore()
    })
    await waitFor(() => expect(result.current.items).toHaveLength(4))
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1, 2])
    expect(result.current.hasMore).toBe(true)
  })

  it('refresh re-requests only page 1', async () => {
    const fetchPage = jest.fn(async (page: number) => ({ items: [{ id: page }], pagination: { has_more: true } }))
    const { result } = await renderHook(() => usePaginatedList('test:refresh', fetchPage))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    await act(async () => {
      await result.current.loadMore()
    })
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    fetchPage.mockClear()
    await act(async () => {
      await result.current.refresh()
    })
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1])
    expect(result.current.items).toHaveLength(1)
    expect(result.current.refreshing).toBe(false)
  })

  it('surfaces errors as a message', async () => {
    const fetchPage = jest.fn(async () => {
      throw new ApiError('Server down', 500, 'INTERNAL_ERROR')
    })
    const { result } = await renderHook(() => usePaginatedList('test:error', fetchPage))
    await waitFor(() => expect(result.current.error).toBe('Server down'))
  })
})

describe('useCategoryContent', () => {
  const page = (n: number) => ({
    data: {
      category: { id: '9', name: 'Cat' },
      books: [{ id: `b${n}` }],
      articles: [],
      books_total: 3,
      articles_total: 0,
    },
  })

  it('does not fetch the same page twice when loadMore is called while loading', async () => {
    mockGetCategory.mockImplementation(async (_id: string, params: { page: number }) => page(params.page))
    const { result } = await renderHook(() => useCategoryContent('9'))
    await waitFor(() => expect(result.current.books).toHaveLength(1))
    await act(async () => {
      void result.current.loadMore()
      void result.current.loadMore()
      void result.current.loadMore()
    })
    await waitFor(() => expect(result.current.books).toHaveLength(2))
    expect(mockGetCategory.mock.calls.map(([, params]) => params.page)).toEqual([1, 2])
    expect(result.current.hasMore).toBe(true)
    expect(result.current.category?.name).toBe('Cat')
  })
})

describe('useCategories', () => {
  it('ignores a stale response for a previous type (keyed per type)', async () => {
    const slow = deferred<unknown>()
    mockFetchCategories.mockImplementation((type?: string) =>
      type === 'book' ? slow.promise : Promise.resolve({ data: { categories: [{ id: 'a1', name: 'Articles' }] } }),
    )
    const { result, rerender } = await renderHook((type: 'book' | 'article') => useCategories(type), { initialProps: 'book' })
    await rerender('article')
    await waitFor(() => expect(result.current.items.map((c) => c.id)).toEqual(['a1']))
    await act(async () => slow.resolve({ data: { categories: [{ id: 'b1', name: 'Books' }] } }))
    await flush()
    expect(result.current.items.map((c) => c.id)).toEqual(['a1'])
  })
})

describe('useReviews', () => {
  const initial = {
    data: {
      reviews: [{ id: 1, rating: 4, content: 'ok', user_id: 'x' }],
      user_review: null,
      summary: { average: 4, count: 1 },
    },
  }

  it('surfaces load errors instead of swallowing them', async () => {
    mockLoadReviews.mockRejectedValue(new ApiError('Reviews unavailable', 503, 'SERVICE_UNAVAILABLE'))
    const { result } = await renderHook(() => useReviews('book', 5))
    await waitFor(() => expect(result.current.error).toBe('Reviews unavailable'))
  })

  it('shows a submitted review optimistically and rolls back on failure', async () => {
    mockLoadReviews.mockResolvedValue(initial)
    const submit = deferred<unknown>()
    mockSubmitReview.mockReturnValue(submit.promise)
    const { result } = await renderHook(() => useReviews('book', 5))
    await waitFor(() => expect(result.current.reviews).toHaveLength(1))

    let submitted!: Promise<void>
    await act(async () => {
      submitted = result.current.submit(2, '  meh  ')
    })
    await waitFor(() => expect(result.current.userReview?.rating).toBe(2))
    expect(result.current.userReview?.content).toBe('meh')
    expect(result.current.summary).toEqual({ average: 3, count: 2 })
    expect(result.current.submitting).toBe(true)

    await act(async () => {
      submit.reject(new ApiError('Nope', 422, 'VALIDATION_ERROR'))
      await submitted.catch(() => undefined)
    })
    await waitFor(() => expect(result.current.userReview).toBeNull())
    expect(result.current.summary).toEqual({ average: 4, count: 1 })
    expect(result.current.error).toBe('Nope')
  })

  it('deletes the viewer review optimistically', async () => {
    mockLoadReviews.mockResolvedValueOnce({
      data: { ...initial.data, user_review: { id: 9, rating: 2, content: 'mine' }, summary: { average: 3, count: 2 } },
    })
    mockLoadReviews.mockResolvedValue(initial)
    const del = deferred<unknown>()
    mockDeleteReview.mockReturnValue(del.promise)
    const { result } = await renderHook(() => useReviews('book', 6))
    await waitFor(() => expect(result.current.userReview?.id).toBe(9))
    let removing!: Promise<void>
    await act(async () => {
      removing = result.current.remove()
    })
    await waitFor(() => expect(result.current.userReview).toBeNull())
    expect(result.current.summary).toEqual({ average: 4, count: 1 })
    await act(async () => {
      del.resolve({ data: { status: 'ok' } })
      await removing
    })
    expect(mockDeleteReview).toHaveBeenCalledWith(9)
  })
})

describe('useBookDetail', () => {
  it('serves a revisit from cache without refetching, and counts one view', async () => {
    mockGetBook.mockResolvedValue({ data: { book: { id: 3, title: 'Three', access: { granted: true } } } })
    mockRelated.mockResolvedValue({ data: { books: [{ id: 3 }, { id: 4 }] } })
    const client = createTestQueryClient()
    const first = await renderHook(() => useBookDetail(3), { client })
    await waitFor(() => expect(first.result.current.book?.title).toBe('Three'))
    expect(first.result.current.related.map((b) => b.id)).toEqual([4])
    expect(mockViews).toHaveBeenCalledTimes(1)
    first.unmount()

    const second = await renderHook(() => useBookDetail(3), { client })
    expect(second.result.current.book?.title).toBe('Three')
    expect(second.result.current.loading).toBe(false)
    await flush()
    expect(mockGetBook).toHaveBeenCalledTimes(1)
  })

  it('reports a missing id without requesting anything', async () => {
    const { result } = await renderHook(() => useBookDetail(undefined))
    expect(result.current.error).toBe('Missing book id')
    expect(result.current.loading).toBe(false)
    expect(mockGetBook).not.toHaveBeenCalled()
  })
})

describe('useSearch', () => {
  it('a late response for an older query never replaces the newer results', async () => {
    const first = deferred<unknown>()
    mockSearch.mockImplementation((q: string) =>
      q === 'old' ? first.promise : Promise.resolve({ data: { books: [{ id: 'new' }], articles: [], authors: [] } }),
    )
    const { result } = await renderHook(() => useSearch())
    await act(async () => {
      void result.current.run('old')
    })
    await act(async () => {
      void result.current.run('new')
    })
    await waitFor(() => expect(result.current.books.map((b) => b.id)).toEqual(['new']))
    await act(async () => first.resolve({ data: { books: [{ id: 'old' }], articles: [], authors: [] } }))
    await flush()
    expect(result.current.books.map((b) => b.id)).toEqual(['new'])
    expect(result.current.searched).toBe(true)

    await act(async () => {
      void result.current.run('   ')
    })
    expect(result.current.books).toEqual([])
    expect(result.current.searched).toBe(false)
  })
})
