import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { Book, Article } from '@loikmon/api'
import { storage } from '@/services/storage'

const BOOKS_KEY = 'library_books'
const ARTICLES_KEY = 'library_articles'

interface LibraryContextValue {
  books: Book[]
  articles: Article[]
  isBookmarked: (type: 'book' | 'article', id: string | number) => boolean
  toggleBook: (book: Book) => void
  toggleArticle: (article: Article) => void
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined)

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([])
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    ;(async () => {
      setBooks((await storage.getJSON<Book[]>(BOOKS_KEY)) ?? [])
      setArticles((await storage.getJSON<Article[]>(ARTICLES_KEY)) ?? [])
    })()
  }, [])

  const isBookmarked = useCallback(
    (type: 'book' | 'article', id: string | number) => {
      const list = type === 'book' ? books : articles
      return list.some((it) => String(it.id) === String(id))
    },
    [books, articles],
  )

  const toggleBook = useCallback((book: Book) => {
    setBooks((prev) => {
      const exists = prev.some((b) => String(b.id) === String(book.id))
      const next = exists ? prev.filter((b) => String(b.id) !== String(book.id)) : [book, ...prev]
      void storage.setJSON(BOOKS_KEY, next)
      return next
    })
  }, [])

  const toggleArticle = useCallback((article: Article) => {
    setArticles((prev) => {
      const exists = prev.some((a) => String(a.id) === String(article.id))
      const next = exists
        ? prev.filter((a) => String(a.id) !== String(article.id))
        : [article, ...prev]
      void storage.setJSON(ARTICLES_KEY, next)
      return next
    })
  }, [])

  const value = useMemo<LibraryContextValue>(
    () => ({ books, articles, isBookmarked, toggleBook, toggleArticle }),
    [books, articles, isBookmarked, toggleBook, toggleArticle],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within a LibraryProvider')
  return ctx
}
