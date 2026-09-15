import { useCallback, useEffect, useState } from 'react'
import { errorMessage, misc } from '@loikmon/api'
import type { HomeResponse } from '@loikmon/api'

/** Home screen feed (`GET /home`): latest/popular/recommended/audio books, articles, authors. */
export function useHome() {
  const [data, setData] = useState<HomeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await misc.home()
      setData(res.data)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load'))
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  return {
    latestBooks: data?.latest_books ?? [],
    popularBooks: data?.popular_books ?? [],
    recommendedBooks: data?.recommended_books ?? [],
    audioBooks: data?.audio_books ?? [],
    articles: data?.articles ?? [],
    authors: data?.authors ?? [],
    loading,
    refreshing,
    error,
    refresh,
  }
}
