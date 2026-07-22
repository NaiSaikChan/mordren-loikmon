import { useCallback, useEffect, useState } from 'react'
import { books as booksApi } from '@loikmon/api'
import type { Book, BookChapter } from '@loikmon/api'
import { parseBooks, parseBookDetail } from '@/lib/normalize'

/** Paginated book list hook (home / books tab / category screens). */
export function useBooks(params?: Record<string, unknown>) {
  const [items, setItems] = useState<Book[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const key = JSON.stringify(params ?? {})

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setError(null)
      try {
        const res = await booksApi.fetchBooks({ ...(params ?? {}), page: String(nextPage) })
        const parsed = parseBooks(res.data)
        setItems((prev) => (replace ? parsed : [...prev, ...parsed]))
        setHasMore(parsed.length > 0)
        setPage(nextPage)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load books')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  useEffect(() => {
    setLoading(true)
    load(0, true).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const loadMore = useCallback(() => {
    if (loading || refreshing || !hasMore) return
    load(page + 1, false)
  }, [loading, refreshing, hasMore, page, load])

  const refresh = useCallback(() => {
    setRefreshing(true)
    load(0, true).finally(() => setRefreshing(false))
  }, [load])

  return { items, loading, refreshing, hasMore, error, loadMore, refresh }
}

/** Single book detail + chapters + related. */
export function useBookDetail(id: string | number) {
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<BookChapter[]>([])
  const [related, setRelated] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [detailRes, chaptersRes, relatedRes] = await Promise.all([
          booksApi.getItem(id),
          booksApi.getChapters(id).catch(() => ({ data: {} })),
          booksApi.relatedBooks(id).catch(() => ({ data: {} })),
        ])
        if (!active) return
        setBook(parseBookDetail(detailRes.data))
        const chapterBody = chaptersRes.data as Record<string, unknown>
        setChapters(
          (chapterBody.chapters as BookChapter[]) ??
            ((chapterBody.data as Record<string, unknown>)?.chapters as BookChapter[]) ??
            [],
        )
        setRelated(parseBooks(relatedRes.data))
        booksApi.updateTotalViews(id).catch(() => undefined)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load book')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  return { book, chapters, related, loading, error }
}
