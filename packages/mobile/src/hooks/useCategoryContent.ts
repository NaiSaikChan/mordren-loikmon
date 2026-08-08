import { useCallback, useEffect, useRef, useState } from 'react'
import { books as booksApi, articles as articlesApi } from '@loikmon/api'
import type { Book, Article } from '@loikmon/api'
import { parseBooks, parseArticles } from '@/lib/normalize'
import { matchesCategory, deduplicateById } from '@/lib/categoryFilter'

/** Loads 3 pages of books + articles for a category, filtering client-side. */
export function useCategoryContent(categoryId: string) {
  const [books, setBooks] = useState<Book[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setBooks([])
    setArticles([])

    const seenBooks = new Set<string>()
    const seenArticles = new Set<string>()
    const accBooks: Book[] = []
    const accArticles: Article[] = []

    try {
      await Promise.all(
        [0, 1, 2].map((p) =>
          Promise.all([
            booksApi.fetchBooks({ category: id, page: String(p) })
              .then((res) => {
                const parsed = parseBooks(res.data)
                for (const b of parsed) {
                  const key = String(b.id)
                  if (matchesCategory(b as any, id) && !seenBooks.has(key)) {
                    seenBooks.add(key)
                    accBooks.push(b)
                  }
                }
              })
              .catch(() => {}),
            articlesApi.fetchArticles({ category: id, page: String(p), limit: '50' })
              .then((res) => {
                const parsed = parseArticles(res.data)
                for (const a of parsed) {
                  const key = String(a.id)
                  if (matchesCategory(a as any, id) && !seenArticles.has(key)) {
                    seenArticles.add(key)
                    accArticles.push(a)
                  }
                }
              })
              .catch(() => {}),
          ])
        )
      )
    } finally {
      setBooks([...accBooks])
      setArticles([...accArticles])
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (categoryId) void load(categoryId)
  }, [categoryId, load])

  const refresh = useCallback(() => load(categoryId), [categoryId, load])

  return { books, articles, loading, refresh }
}
