import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authors as authorsApi, errorMessage } from '@loikmon/api'
import type { Article, Author, Book } from '@loikmon/api'
import { useAccessKey } from '@/context/AuthContext'
import { queryKeys } from '@/lib/queryClient'
import { DETAIL_STALE_TIME, keepSameItem } from './useBooks'
import { usePaginatedList } from './usePaginatedList'

/** Paginated authors list, optionally filtered by a search query. */
export function useAuthors(query = '') {
  const fetchPage = useCallback(
    async (page: number) => {
      const { data } = await authorsApi.fetchAuthors({ page, limit: 20, q: query.trim() || undefined })
      return { items: data.authors, pagination: data.pagination }
    },
    [query],
  )
  return usePaginatedList<Author>(`authors:${query}`, fetchPage)
}

interface AuthorDetailData {
  author: Author
  books: Book[]
  articles: Article[]
}

const EMPTY_BOOKS: Book[] = []
const EMPTY_ARTICLES: Article[] = []

/** Author profile with their books and articles, plus follow/unfollow. */
export function useAuthorDetail(id: string | number | undefined) {
  // `is_following` depends on the signed-in user.
  const accessKey = useAccessKey()
  const queryClient = useQueryClient()
  const authorId = id == null ? '' : String(id).trim()
  const hasId = authorId !== ''
  const queryKey = queryKeys.author(authorId, accessKey)

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AuthorDetailData> => {
      const { data } = await authorsApi.getAuthor(authorId)
      return { author: data.author, books: data.books, articles: data.articles }
    },
    enabled: hasId,
    staleTime: DETAIL_STALE_TIME,
    placeholderData: keepSameItem<AuthorDetailData>(authorId),
  })

  const author = query.data?.author ?? null

  const follow = useMutation({
    mutationFn: async (target: Author) =>
      (target.is_following ? await authorsApi.unfollow(target.id) : await authorsApi.follow(target.id)).data,
    onSuccess: (data) => {
      queryClient.setQueryData<AuthorDetailData>(queryKey, (prev) =>
        prev ? { ...prev, author: { ...prev.author, is_following: data.is_following, followers_count: data.followers_count } } : prev,
      )
    },
  })

  const { mutateAsync } = follow
  const toggleFollow = useCallback(async () => {
    if (!author) return
    await mutateAsync(author)
  }, [author, mutateAsync])

  const error = !hasId
    ? 'Missing author id'
    : follow.error
      ? errorMessage(follow.error, 'Failed to update follow status')
      : query.error
        ? errorMessage(query.error, 'Failed to load author')
        : null

  return {
    author,
    books: query.data?.books ?? EMPTY_BOOKS,
    articles: query.data?.articles ?? EMPTY_ARTICLES,
    loading: hasId && query.isPending,
    error,
    following: follow.isPending,
    toggleFollow,
  }
}
