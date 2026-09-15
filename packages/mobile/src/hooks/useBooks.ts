import { useCallback, useEffect, useRef, useState } from 'react'
import { books as booksApi, errorMessage } from '@loikmon/api'
import type { Book, BookDetail, BookQuery } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { stableKey } from '@/lib/stableKey'
import { usePaginatedList } from './usePaginatedList'

/** Paginated book list (books tab / audiobooks / filtered lists). */
export function useBooks(params: Omit<BookQuery, 'page'> = {}) {
  const key = stableKey(params)
  const fetchPage = useCallback(
    async (page: number) => {
      const { data } = await booksApi.fetchBooks({ limit: 20, ...params, page })
      return { items: data.books, pagination: data.pagination }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return usePaginatedList<Book>(key, fetchPage)
}

/**
 * Book detail (with the server's `access` decision) + related books.
 * Re-fetches when the session/entitlement changes so `access` stays current.
 * Counts one view per opened book.
 */
export function useBookDetail(id: string | number | undefined, options: { trackView?: boolean } = {}) {
  const trackView = options.trackView ?? true
  const { user, entitlement } = useAuth()
  const [book, setBook] = useState<BookDetail | null>(null)
  const [related, setRelated] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const viewedId = useRef<string | null>(null)
  const loadedId = useRef<string | null>(null)

  const accessKey = `${user?.id ?? ''}:${entitlement?.active ? 1 : 0}`

  useEffect(() => {
    if (id == null || String(id) === '') {
      setLoading(false)
      setError('Missing book id')
      return
    }
    let active = true
    // Only show the full-screen spinner for a different book, not for access refreshes.
    const isNewBook = loadedId.current !== String(id)
    ;(async () => {
      if (isNewBook) {
        setLoading(true)
        setBook(null)
        setRelated([])
      }
      setError(null)
      try {
        const [detail, relatedRes] = await Promise.all([
          booksApi.getBook(id),
          isNewBook ? booksApi.relatedBooks(id).catch(() => null) : Promise.resolve(null),
        ])
        if (!active) return
        loadedId.current = String(id)
        setBook(detail.data.book)
        if (relatedRes) setRelated(relatedRes.data.books.filter((b) => String(b.id) !== String(id)))
      } catch (err) {
        if (active) setError(errorMessage(err, 'Failed to load book'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id, accessKey, version])

  useEffect(() => {
    if (!trackView || id == null || viewedId.current === String(id)) return
    viewedId.current = String(id)
    booksApi.updateTotalViews(id).catch(() => undefined)
  }, [id, trackView])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { book, related, loading, error, reload }
}
