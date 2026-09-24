import { useCallback, useEffect, useRef } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { books as booksApi, errorMessage } from '@loikmon/api'
import type { Book, BookDetail, BookQuery } from '@loikmon/api'
import { useAccessKey } from '@/context/AuthContext'
import { queryKeys } from '@/lib/queryClient'
import { stableKey } from '@/lib/stableKey'
import { usePaginatedList } from './usePaginatedList'

/** Detail screens are revisited often (back navigation): don't refetch within 5 minutes. */
export const DETAIL_STALE_TIME = 5 * 60_000

/** Paginated book list (books tab / audiobooks / filtered lists). */
export function useBooks(params: Omit<BookQuery, 'page'> = {}) {
  const key = stableKey(params)
  const fetchPage = useCallback(
    async (page: number) => {
      // Filter to show only free books (premium content disabled)
      const { data } = await booksApi.fetchBooks({ limit: 20, ...params, free: true, page })
      return { items: data.books, pagination: data.pagination }
    },
    // `key` is the serialised `params`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return usePaginatedList<Book>(`books:${key}`, fetchPage)
}

/** Keeps the previous detail of the *same* item on screen while an access refresh (login, subscription) loads. */
export function keepSameItem<T>(id: string) {
  return (previous: T | undefined, previousQuery: { queryKey: readonly unknown[] } | undefined) =>
    previousQuery?.queryKey[1] === id ? keepPreviousData(previous) : undefined
}

/**
 * Book detail (with the server's `access` decision) + related books.
 * Cached per session/entitlement so `access` stays current and back
 * navigation is instant. Counts one view per opened book.
 */
export function useBookDetail(id: string | number | undefined, options: { trackView?: boolean } = {}) {
  const trackView = options.trackView ?? true
  const accessKey = useAccessKey()
  const bookId = id == null ? '' : String(id)
  const hasId = bookId !== ''
  const viewedId = useRef<string | null>(null)

  const detail = useQuery({
    queryKey: queryKeys.book(bookId, accessKey),
    queryFn: async () => (await booksApi.getBook(bookId)).data.book,
    enabled: hasId,
    staleTime: DETAIL_STALE_TIME,
    placeholderData: keepSameItem<BookDetail>(bookId),
  })

  const related = useQuery({
    queryKey: queryKeys.relatedBooks(bookId),
    queryFn: async () => {
      try {
        const { data } = await booksApi.relatedBooks(bookId)
        return data.books.filter((b) => String(b.id) !== bookId)
      } catch {
        return [] as Book[] // optional section: never fail the screen
      }
    },
    enabled: hasId,
    staleTime: DETAIL_STALE_TIME,
  })

  useEffect(() => {
    if (!trackView || !hasId || viewedId.current === bookId) return
    viewedId.current = bookId
    booksApi.updateTotalViews(bookId).catch(() => undefined)
  }, [bookId, hasId, trackView])

  const { refetch } = detail
  const reload = useCallback(() => {
    void refetch()
  }, [refetch])

  return {
    book: detail.data ?? null,
    related: related.data ?? EMPTY_BOOKS,
    loading: hasId && detail.isPending,
    error: !hasId ? 'Missing book id' : detail.error ? errorMessage(detail.error, 'Failed to load book') : null,
    reload,
  }
}

const EMPTY_BOOKS: Book[] = []
