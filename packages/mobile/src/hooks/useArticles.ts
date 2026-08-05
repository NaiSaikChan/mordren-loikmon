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

export function useArticleDetail(id: string | number | string[] | undefined) {
  const [article, setArticle] = useState<Article | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [author, setAuthor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const articleId = Array.isArray(id) ? id[0] : id
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      setArticle(null)
      if (articleId == null || String(articleId).trim() === '') {
        if (active) {
          setError('Missing article id')
          setLoading(false)
        }
        return
      }
      try {
        const res = await articlesApi.updateArticleTotalViews(articleId)
        if (!active) return
        const parsed = parseArticleDetail(res.data)
        if (parsed) {
          setArticle(parsed)
        } else {
          const listRes = await articlesApi.fetchArticles()
          if (!active) return
          const fallback = parseArticles(listRes.data).find(
            (item) => String(item.id) === String(articleId),
          )
          if (!fallback) {
            throw new Error('Article not found')
          }
          setArticle(fallback)
        }
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
