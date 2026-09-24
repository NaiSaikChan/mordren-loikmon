import { useCallback, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { errorMessage, misc } from '@loikmon/api'
import type { HomeResponse } from '@loikmon/api'
import { useAccessKey } from '@/context/AuthContext'
import { queryKeys } from '@/lib/queryClient'

const EMPTY: never[] = []

/** Home screen feed (`GET /home`): latest/popular/recommended/audio books, articles, authors. */
export function useHome() {
  const accessKey = useAccessKey()
  const [refreshing, setRefreshing] = useState(false)
  const query = useQuery({
    queryKey: queryKeys.home(accessKey),
    queryFn: async (): Promise<HomeResponse> => (await misc.home()).data,
    // Signing in/out re-keys the feed; keep the old one on screen until the new one arrives.
    placeholderData: keepPreviousData,
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

  const data = query.data
  return {
    latestBooks: data?.latest_books ?? EMPTY,
    popularBooks: data?.popular_books ?? EMPTY,
    recommendedBooks: data?.recommended_books ?? EMPTY,
    audioBooks: data?.audio_books ?? EMPTY,
    articles: data?.articles ?? EMPTY,
    authors: data?.authors ?? EMPTY,
    loading: query.isPending,
    refreshing,
    error: query.error ? errorMessage(query.error, 'Failed to load') : null,
    refresh,
  }
}
