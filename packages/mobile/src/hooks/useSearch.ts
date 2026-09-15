import { useCallback, useRef, useState } from 'react'
import { errorMessage, search as searchApi } from '@loikmon/api'
import type { Article, Author, Book } from '@loikmon/api'

/** Full-text search across books, articles and authors (`GET /search`). */
export function useSearch() {
  const [books, setBooks] = useState<Book[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const latest = useRef(0)

  const run = useCallback(async (q: string) => {
    const trimmed = q.trim()
    setQuery(q)
    const requestId = ++latest.current
    if (!trimmed) {
      setBooks([])
      setArticles([])
      setAuthors([])
      setSearched(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data } = await searchApi.search(trimmed, { type: 'all', page: 1, limit: 20 })
      if (requestId !== latest.current) return
      setBooks(data.books)
      setArticles(data.articles)
      setAuthors(data.authors)
      setSearched(true)
    } catch (err) {
      if (requestId === latest.current) setError(errorMessage(err, 'Search failed'))
    } finally {
      if (requestId === latest.current) setLoading(false)
    }
  }, [])

  return { books, articles, authors, loading, query, error, searched, run }
}
