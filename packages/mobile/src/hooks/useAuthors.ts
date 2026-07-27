import { useCallback, useEffect, useState } from 'react'
import { articles as articlesApi, authors as authorsApi, books as booksApi } from '@loikmon/api'
import type { Article, Author, Book } from '@loikmon/api'
import { parseArticles, parseAuthors, parseBooks } from '@/lib/normalize'

type AnyRecord = Record<string, unknown>

function toRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {}
}

function parseAuthorDetail(body: unknown): Author | null {
  if (Array.isArray(body)) {
    const first = body[0]
    return first && typeof first === 'object' ? (first as Author) : null
  }

  const b = toRecord(body)
  const data = toRecord(b.data)
  const direct = [b.author, data.author, b.author_data, data.author_data, data, b]
    .find((item) => item && typeof item === 'object' && !Array.isArray(item)) as Author | undefined

  if (direct && (direct.id != null || direct.name)) return direct
  return null
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
    if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
  }
  return null
}

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

export function useAuthorDetail(id: string | number | string[] | undefined, email?: string) {
  const [author, setAuthor] = useState<Author | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const authorId = Array.isArray(id) ? id[0] : id
    let active = true

    ;(async () => {
      setLoading(true)
      setError(null)
      setAuthor(null)
      setBooks([])
      setArticles([])

      if (authorId == null || String(authorId).trim() === '') {
        if (active) {
          setError('Missing author id')
          setLoading(false)
        }
        return
      }

      try {
        const [authorRes, booksRes, articlesRes] = await Promise.all([
          authorsApi.getAuthorData(authorId, email),
          booksApi
            .fetchBooks({
              email: email ?? 'null',
              id: authorId,
              type: 1,
              page: '0',
              cat: 0,
              sub: '0',
            })
            .catch(() => ({ data: {} })),
          articlesApi
            .fetchArticles({
              category: 0,
              email: email ?? 'null',
              itm: authorId,
              itmtype: 1,
              page: '0',
              sub: '0',
              type: 0,
            })
            .catch(() => ({ data: {} })),
        ])
        if (!active) return

        const parsedAuthor = parseAuthorDetail(authorRes.data)
        if (!parsedAuthor) {
          throw new Error('Author not found')
        }
        setAuthor(parsedAuthor)
        setBooks(parseBooks(booksRes.data))
        setArticles(parseArticles(articlesRes.data))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load author')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [id, email])

  const toggleFollow = useCallback(async () => {
    if (!author) return
    setFollowing(true)
    try {
      const res = await authorsApi.followUnfollow(author.id, email)
      const body = toRecord(res.data)
      const next = toBoolean(body.is_following ?? toRecord(body.data).is_following)
      setAuthor((prev) => {
        if (!prev) return prev
        const isFollowing = next ?? !Boolean(prev.is_following)
        return {
          ...prev,
          is_following: isFollowing,
          followers_count:
            typeof prev.followers_count === 'number'
              ? Math.max(0, prev.followers_count + (isFollowing ? 1 : -1))
              : prev.followers_count,
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update follow status')
      throw err
    } finally {
      setFollowing(false)
    }
  }, [author, email])

  return { author, books, articles, loading, error, following, toggleFollow }
}
