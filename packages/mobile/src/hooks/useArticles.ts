import { useCallback, useEffect, useRef, useState } from 'react'
import { articles as articlesApi, errorMessage } from '@loikmon/api'
import type { Article, ArticleDetail, ArticleQuery } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { stableKey } from '@/lib/stableKey'
import { usePaginatedList } from './usePaginatedList'

export function useArticles(params: Omit<ArticleQuery, 'page'> = {}) {
  const key = stableKey(params)
  const fetchPage = useCallback(
    async (page: number) => {
      const { data } = await articlesApi.fetchArticles({ limit: 20, ...params, page })
      return { items: data.articles, pagination: data.pagination }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return usePaginatedList<Article>(key, fetchPage)
}

/**
 * Article with body/audio when the viewer has access (`locked: false`),
 * otherwise metadata + excerpt only. Re-fetches when the entitlement changes.
 */
export function useArticleDetail(id: string | number | undefined) {
  const { user, entitlement } = useAuth()
  const [article, setArticle] = useState<ArticleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const viewedId = useRef<string | null>(null)
  const loadedId = useRef<string | null>(null)

  const accessKey = `${user?.id ?? ''}:${entitlement?.active ? 1 : 0}`

  useEffect(() => {
    if (id == null || String(id).trim() === '') {
      setError('Missing article id')
      setLoading(false)
      return
    }
    let active = true
    const isNew = loadedId.current !== String(id)
    ;(async () => {
      if (isNew) {
        setLoading(true)
        setArticle(null)
      }
      setError(null)
      try {
        const { data } = await articlesApi.getArticle(id)
        if (!active) return
        loadedId.current = String(id)
        setArticle(data.article)
      } catch (err) {
        if (active) setError(errorMessage(err, 'Failed to load article'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id, accessKey, version])

  useEffect(() => {
    if (id == null || viewedId.current === String(id)) return
    viewedId.current = String(id)
    articlesApi.updateArticleTotalViews(id).catch(() => undefined)
  }, [id])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { article, loading, error, reload }
}
