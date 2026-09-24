import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { categories as catApi, errorMessage } from '@loikmon/api'
import { applyCategoryPage, categoryHasMore, emptyCategoryState, type CategoryPageState } from '@/lib/pagination'
import { firstPageOnly } from './usePaginatedList'

const PAGE_SIZE = 20

type CategoryPage = Parameters<typeof applyCategoryPage>[2]

export const categoryContentKey = (categoryId: string) => ['category', categoryId, 'content'] as const

function mergePages(data: InfiniteData<CategoryPage, number> | undefined): CategoryPageState {
  if (!data) return emptyCategoryState
  return data.pages.reduce((state, page, index) => applyCategoryPage(state, data.pageParams[index] ?? 1, page), emptyCategoryState)
}

/**
 * Books and articles of a category, filtered server-side (`categories.getCategory`).
 * Pages are fetched with `useInfiniteQuery`, so repeated `loadMore` calls
 * while a page is loading join that request instead of fetching it twice.
 */
export function useCategoryContent(categoryId: string | undefined) {
  const queryClient = useQueryClient()
  const id = categoryId ?? ''
  const queryKey = useMemo(() => categoryContentKey(id), [id])
  const [refreshing, setRefreshing] = useState(false)

  const query = useInfiniteQuery<CategoryPage, Error, InfiniteData<CategoryPage, number>, readonly unknown[], number>({
    queryKey,
    queryFn: async ({ pageParam }): Promise<CategoryPage> => (await catApi.getCategory(id, { page: pageParam, limit: PAGE_SIZE })).data,
    initialPageParam: 1,
    getNextPageParam: (_last, pages, lastPageParam) => {
      const merged = pages.reduce((state, page, index) => applyCategoryPage(state, index + 1, page), emptyCategoryState)
      return categoryHasMore(merged) ? lastPageParam + 1 : undefined
    },
    enabled: id !== '',
  })

  const state = useMemo(() => mergePages(query.data), [query.data])
  const { refetch, fetchNextPage, hasNextPage, isFetching } = query

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      queryClient.setQueryData<InfiniteData<CategoryPage, number>>(queryKey, firstPageOnly)
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, queryKey, refetch])

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isFetching) return
    await fetchNextPage({ cancelRefetch: false })
  }, [hasNextPage, isFetching, fetchNextPage])

  return {
    category: state.category,
    books: state.books,
    articles: state.articles,
    booksTotal: state.booksTotal,
    articlesTotal: state.articlesTotal,
    hasMore: categoryHasMore(state),
    loading: query.isLoading || refreshing,
    loadingMore: query.isFetchingNextPage,
    error: query.error ? errorMessage(query.error, 'Failed to load category') : null,
    refresh,
    loadMore,
  }
}
