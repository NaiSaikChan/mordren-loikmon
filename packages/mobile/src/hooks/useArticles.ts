import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { articles as articlesApi, errorMessage } from '@loikmon/api'
import type { Article, ArticleDetail, ArticleQuery } from '@loikmon/api'
import { useAccessKey } from '@/context/AuthContext'
import { queryKeys } from '@/lib/queryClient'
import { stableKey } from '@/lib/stableKey'
import { DETAIL_STALE_TIME, keepSameItem } from './useBooks'
import { usePaginatedList } from './usePaginatedList'

export function useArticles(params: Omit<ArticleQuery, 'page'> = {}) {
  const key = stableKey(params)
  const fetchPage = useCallback(
    async (page: number) => {
      const { data } = await articlesApi.fetchArticles({ limit: 20, ...params, page })
      return { items: data.articles, pagination: data.pagination }
    },
    // `key` is the serialised `params`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return usePaginatedList<Article>(`articles:${key}`, fetchPage)
}

/**
 * Article with body/audio when the viewer has access (`locked: false`),
 * otherwise metadata + excerpt only. Cached per session/entitlement, so it
 * re-fetches when the entitlement changes but not on back navigation.
 */
export function useArticleDetail(id: string | number | undefined) {
  const accessKey = useAccessKey()
  const articleId = id == null ? '' : String(id).trim()
  const hasId = articleId !== ''
  const viewedId = useRef<string | null>(null)

  const query = useQuery({
    queryKey: queryKeys.article(articleId, accessKey),
    queryFn: async () => (await articlesApi.getArticle(articleId)).data.article,
    enabled: hasId,
    staleTime: DETAIL_STALE_TIME,
    placeholderData: keepSameItem<ArticleDetail>(articleId),
  })

  useEffect(() => {
    if (!hasId || viewedId.current === articleId) return
    viewedId.current = articleId
    articlesApi.updateArticleTotalViews(articleId).catch(() => undefined)
  }, [articleId, hasId])

  const { refetch } = query
  const reload = useCallback(() => {
    void refetch()
  }, [refetch])

  return {
    article: query.data ?? null,
    loading: hasId && query.isPending,
    error: !hasId ? 'Missing article id' : query.error ? errorMessage(query.error, 'Failed to load article') : null,
    reload,
  }
}
