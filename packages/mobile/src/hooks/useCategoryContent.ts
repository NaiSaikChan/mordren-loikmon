import { useCallback, useEffect, useRef, useState } from 'react'
import { categories as catApi, errorMessage } from '@loikmon/api'
import { applyCategoryPage, categoryHasMore, emptyCategoryState, type CategoryPageState } from '@/lib/pagination'

const PAGE_SIZE = 20

/** Books and articles of a category, filtered server-side (`categories.getCategory`). */
export function useCategoryContent(categoryId: string | undefined) {
  const [state, setState] = useState<CategoryPageState>(emptyCategoryState)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const generation = useRef(0)

  const load = useCallback(
    async (page: number) => {
      if (!categoryId) return
      const gen = generation.current
      setError(null)
      try {
        const { data } = await catApi.getCategory(categoryId, { page, limit: PAGE_SIZE })
        if (gen !== generation.current) return
        setState((prev) => applyCategoryPage(prev, page, data))
      } catch (err) {
        if (gen === generation.current) setError(errorMessage(err, 'Failed to load category'))
      }
    },
    [categoryId],
  )

  const refresh = useCallback(async () => {
    generation.current++
    setLoading(true)
    try {
      await load(1)
    } finally {
      setLoading(false)
    }
  }, [load])

  useEffect(() => {
    setState(emptyCategoryState)
    void refresh()
  }, [refresh])

  const loadMore = useCallback(async () => {
    const current = stateRef.current
    if (loadingMore || !categoryHasMore(current)) return
    setLoadingMore(true)
    try {
      await load(current.page + 1)
    } finally {
      setLoadingMore(false)
    }
  }, [load, loadingMore])

  return {
    category: state.category,
    books: state.books,
    articles: state.articles,
    booksTotal: state.booksTotal,
    articlesTotal: state.articlesTotal,
    hasMore: categoryHasMore(state),
    loading,
    loadingMore,
    error,
    refresh,
    loadMore,
  }
}
