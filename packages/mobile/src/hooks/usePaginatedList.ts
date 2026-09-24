import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { errorMessage, type Pagination } from '@loikmon/api'
import { FIRST_PAGE, applyPage, initialPageState } from '@/lib/pagination'

export interface PageResult<T> {
  items: T[]
  pagination?: Pick<Pagination, 'has_more'> | null
}

/** Cache key of a paginated list; `key` must be unique across list kinds (e.g. `books:{…}`). */
export const paginatedListKey = (key: string) => ['list', key] as const

/** Keep only the first page, so a pull-to-refresh re-requests page 1 instead of every loaded page. */
export function firstPageOnly<P>(data: InfiniteData<P, number> | undefined): InfiniteData<P, number> | undefined {
  if (!data || data.pages.length <= 1) return data
  return { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }
}

/**
 * Generic 1-based paginated list: initial load, pull-to-refresh and infinite
 * scroll driven by the backend's `pagination.has_more` (React Query
 * `useInfiniteQuery`: cached per `key`, de-duplicated, retried with backoff).
 *
 * `key` identifies the query; when it changes the list loads from page 1.
 */
export function usePaginatedList<T extends { id: unknown }>(
  key: string,
  fetchPage: (page: number) => Promise<PageResult<T>>,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => paginatedListKey(key), [key])
  const [refreshing, setRefreshing] = useState(false)

  const query = useInfiniteQuery<PageResult<T>, Error, InfiniteData<PageResult<T>, number>, readonly unknown[], number>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (lastPage, _pages, lastPageParam) => (lastPage.pagination?.has_more ? lastPageParam + 1 : undefined),
    enabled,
  })

  const state = useMemo(() => {
    const data = query.data
    if (!data) return initialPageState<T>()
    return data.pages.reduce(
      (acc, page, index) => applyPage(acc, data.pageParams[index] ?? FIRST_PAGE, page.items, page.pagination),
      initialPageState<T>(),
    )
  }, [query.data])

  const { refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = query

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      queryClient.setQueryData<InfiniteData<PageResult<T>, number>>(queryKey, firstPageOnly)
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, queryKey, refetch])

  const loadMore = useCallback(async () => {
    // `cancelRefetch: false` joins an in-flight request instead of firing a duplicate
    // (onEndReached often fires twice before the next render).
    if (!enabled || !hasNextPage || isFetchingNextPage || isFetching) return
    await fetchNextPage({ cancelRefetch: false })
  }, [enabled, hasNextPage, isFetchingNextPage, isFetching, fetchNextPage])

  return {
    items: state.items,
    hasMore: state.hasMore,
    loading: enabled && query.isLoading,
    refreshing,
    loadingMore: isFetchingNextPage,
    error: query.error ? errorMessage(query.error, 'Failed to load') : null,
    refresh,
    loadMore,
  }
}
