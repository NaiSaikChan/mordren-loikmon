import { useCallback, useState } from 'react'
import { search as searchApi } from '@loikmon/api'
import type { Book, Article } from '@loikmon/api'
import { parseBooks, parseArticles } from '@/lib/normalize'

/**
 * Full-text search across books (type=0) and articles (type=1).
 * The loikmon.org `search` endpoint returns results under a `search` key.
 */
export function useSearch() {
  const [books, setBooks] = useState<Book[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const run = useCallback(async (q: string) => {
    const trimmed = q.trim()
    setQuery(q)
    if (!trimmed) {
      setBooks([])
      setArticles([])
      setSearched(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [bookRes, articleRes] = await Promise.all([
        searchApi.search(trimmed, 0, 0),
        searchApi.search(trimmed, 1, 0),
      ])
      const bookBody = bookRes.data as Record<string, unknown>
      const articleBody = articleRes.data as Record<string, unknown>
      setBooks(parseBooks(bookBody.search ?? bookBody))
      setArticles(parseArticles(articleBody.search ?? articleBody))
      setSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  return { books, articles, loading, query, error, searched, run }
}
