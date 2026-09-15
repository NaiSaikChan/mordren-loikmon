import { useCallback, useEffect, useState } from 'react'
import { authors as authorsApi, errorMessage } from '@loikmon/api'
import type { Article, Author, Book } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
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

/** Author profile with their books and articles, plus follow/unfollow. */
export function useAuthorDetail(id: string | number | undefined) {
  const { user } = useAuth()
  const [author, setAuthor] = useState<Author | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (id == null || String(id).trim() === '') {
        setError('Missing author id')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const { data } = await authorsApi.getAuthor(id)
        if (!active) return
        setAuthor(data.author)
        setBooks(data.books)
        setArticles(data.articles)
      } catch (err) {
        if (active) setError(errorMessage(err, 'Failed to load author'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // `is_following` depends on the signed-in user.
  }, [id, user?.id])

  const toggleFollow = useCallback(async () => {
    if (!author) return
    setFollowing(true)
    try {
      const { data } = author.is_following ? await authorsApi.unfollow(author.id) : await authorsApi.follow(author.id)
      setAuthor((prev) => (prev ? { ...prev, is_following: data.is_following, followers_count: data.followers_count } : prev))
    } catch (err) {
      setError(errorMessage(err, 'Failed to update follow status'))
      throw err
    } finally {
      setFollowing(false)
    }
  }, [author])

  return { author, books, articles, loading, error, following, toggleFollow }
}
