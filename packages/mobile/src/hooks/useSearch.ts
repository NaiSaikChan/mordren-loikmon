import { useCallback, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { errorMessage, search as searchApi } from '@loikmon/api'
import type { Article, Author, Book } from '@loikmon/api'

const NO_BOOKS: Book[] = []
const NO_ARTICLES: Article[] = []
const NO_AUTHORS: Author[] = []

export const searchKey = (q: string) => ['search', q] as const

/**
 * Full-text search across books, articles and authors (`GET /search`).
 * Results are cached per query, and a slow response for an older query can
 * never overwrite a newer one (each query has its own cache entry).
 */
export function useSearch() {
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const enabled = trimmed !== ''

  const result = useQuery({
    queryKey: searchKey(trimmed),
    queryFn: async () => (await searchApi.search(trimmed, { type: 'all', page: 1, limit: 20 })).data,
    enabled,
    // Keep the previous results on screen while the next query loads.
    placeholderData: keepPreviousData,
  })

  const run = useCallback(async (q: string) => {
    setQuery(q)
  }, [])

  const data = enabled ? result.data : undefined
  return {
    books: data?.books ?? NO_BOOKS,
    articles: data?.articles ?? NO_ARTICLES,
    authors: data?.authors ?? NO_AUTHORS,
    loading: enabled && result.isFetching,
    query,
    error: enabled && result.error ? errorMessage(result.error, 'Search failed') : null,
    searched: enabled && result.data !== undefined,
    run,
  }
}
