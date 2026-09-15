import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, type Pagination } from '@loikmon/api'
import { FIRST_PAGE, applyPage, initialPageState, nextPage, type PageState } from '@/lib/pagination'

export interface PageResult<T> {
  items: T[]
  pagination?: Pick<Pagination, 'has_more'> | null
}

/**
 * Generic 1-based paginated list: initial load, pull-to-refresh and infinite
 * scroll driven by the backend's `pagination.has_more`.
 *
 * `key` identifies the query; when it changes the list reloads from page 1.
 */
export function usePaginatedList<T extends { id: unknown }>(
  key: string,
  fetchPage: (page: number) => Promise<PageResult<T>>,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true
  const [state, setState] = useState<PageState<T>>(initialPageState)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const stateRef = useRef(state)
  stateRef.current = state
  /** Increments per query so late responses of an old query are ignored. */
  const generation = useRef(0)
  const busy = useRef(false)

  const load = useCallback(async (page: number) => {
    const gen = generation.current
    busy.current = true
    setError(null)
    try {
      const result = await fetchRef.current(page)
      if (gen !== generation.current) return
      setState((prev) => applyPage(page === FIRST_PAGE ? initialPageState<T>() : prev, page, result.items, result.pagination))
    } catch (err) {
      if (gen === generation.current) setError(errorMessage(err, 'Failed to load'))
    } finally {
      if (gen === generation.current) busy.current = false
    }
  }, [])

  useEffect(() => {
    generation.current++
    busy.current = false
    setState(initialPageState<T>())
    if (!enabled) return
    setLoading(true)
    load(FIRST_PAGE).finally(() => setLoading(false))
  }, [key, enabled, load])

  const refresh = useCallback(async () => {
    generation.current++
    busy.current = false
    setRefreshing(true)
    try {
      await load(FIRST_PAGE)
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const loadMore = useCallback(async () => {
    const page = nextPage(stateRef.current)
    if (!enabled || busy.current || page === null || page === FIRST_PAGE) return
    setLoadingMore(true)
    try {
      await load(page)
    } finally {
      setLoadingMore(false)
    }
  }, [enabled, load])

  return {
    items: state.items,
    hasMore: state.hasMore,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
  }
}
