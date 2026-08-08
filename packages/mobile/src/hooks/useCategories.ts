import { useCallback, useEffect, useState } from 'react'
import { categories as catApi } from '@loikmon/api'
import type { Category } from '@loikmon/api'

export function useCategories() {
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await catApi.fetchCategories()
      const body = res.data as any
      setItems(body.categories ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  return { items, loading, error, refresh: fetch }
}
