import { useMemo } from 'react'
import { usePurchases } from './usePurchases'

/**
 * Ownership hook for books and articles.
 *
 * Uses the app-wide purchases cache so screens don't each fetch the
 * purchases endpoint. Falls back to false while loading or if the user
 * is logged out.
 */
export function useIsOwned(id: string | number | undefined, type: 'book' | 'article' = 'book') {
  const { books, articles, loading, error } = usePurchases()

  const owned = useMemo(() => {
    if (id == null) return false
    const target = String(id)
    const list = type === 'book' ? books : articles
    return list.some((item) => String(item.id) === target)
  }, [id, type, books, articles])

  return { owned, loading, error }
}
