import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { categories as catApi, errorMessage } from '@loikmon/api'
import type { Category } from '@loikmon/api'
import { queryKeys } from '@/lib/queryClient'

const EMPTY: Category[] = []

/** Categories rarely change: cache them for 30 minutes. */
const CATEGORIES_STALE_TIME = 30 * 60_000

export function useCategories(type?: 'book' | 'article') {
  const [refreshing, setRefreshing] = useState(false)
  const query = useQuery({
    queryKey: [...queryKeys.categories(), type ?? 'all'],
    queryFn: async () => (await catApi.fetchCategories(type)).data.categories ?? EMPTY,
    staleTime: CATEGORIES_STALE_TIME,
  })

  const { refetch } = query
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  return {
    items: query.data ?? EMPTY,
    loading: query.isLoading || refreshing,
    error: query.error ? errorMessage(query.error, 'Failed to load categories') : null,
    refresh,
  }
}
