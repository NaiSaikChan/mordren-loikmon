import { useCallback, useEffect, useState } from 'react'
import { articles as articlesApi } from '@loikmon/api'
import type { Article } from '@loikmon/api'
import { parseArticles, parseArticleDetail } from '@/lib/normalize'
import { stableKey } from '@/lib/stableKey'

export function useArticles(params?: Record<string, unknown>) {
  const [items, setItems] = useState<Article[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const key = stableKey(params)

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setError(null)
      try {
        const res = await articlesApi.fetchArticles({ ...(params ?? {}), page: String(nextPage) })
        const parsed = parseArticles(res.data)
        setItems((prev) => (replace ? parsed : [...prev, ...parsed]))
        setHasMore(parsed.length > 0)
        setPage(nextPage)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load articles')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  useEffect(() => {
    setLoading(true)
    load(0, true).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const loadMore = useCallback(() => {
    if (loading || refreshing || !hasMore) return
    load(page + 1, false)
  }, [loading, refreshing, hasMore, page, load])

  const refresh = useCallback(() => {
    setRefreshing(true)
    load(0, true).finally(() => setRefreshing(false))
  }, [load])

  return { items, loading, refreshing, hasMore, error, loadMore, refresh }
}

export function useArticleDetail(id: string | number) {
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await articlesApi.getArticle(id)
        if (!active) return
        setArticle(parseArticleDetail(res.data))
        articlesApi.updateArticleTotalViews(id).catch(() => undefined)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load article')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  return { article, loading, error }
}
