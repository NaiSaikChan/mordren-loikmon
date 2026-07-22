import { useEffect, useState } from 'react'
import { authors as authorsApi } from '@loikmon/api'
import type { Author, Book } from '@loikmon/api'
import { parseAuthors, parseBooks } from '@/lib/normalize'

export function useAuthors(query = '') {
  const [items, setItems] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await authorsApi.fetchAuthors({ query })
        if (active) setItems(parseAuthors(res.data))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load authors')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [query])

  return { items, loading, error }
}

export function useAuthorDetail(id: string | number) {
  const [author, setAuthor] = useState<Author | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await authorsApi.getAuthorData(id)
        if (!active) return
        const body = res.data as Record<string, unknown>
        setAuthor(
          ((body.author ?? (body.data as Record<string, unknown>)?.author) as Author) ?? null,
        )
        setBooks(parseBooks(body.books ? { books: body.books } : body))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load author')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  return { author, books, loading, error }
}
