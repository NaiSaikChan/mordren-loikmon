import { useCallback, useEffect, useState } from 'react'
import { categories as catApi, errorMessage } from '@loikmon/api'
import type { Category } from '@loikmon/api'

export function useCategories(type?: 'book' | 'article') {
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await catApi.fetchCategories(type)
      setItems(data.categories ?? [])
    } catch (err) {
      setError(errorMessage(err, 'Failed to load categories'))
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => {
    void fetch()
  }, [fetch])

  return { items, loading, error, refresh: fetch }
}
