import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Article, Book } from '@loikmon/api'
import { useSessionUserId } from '@/context/AuthContext'
import {
  EMPTY_LIBRARY,
  GUEST_OWNER,
  clearUserLibraryCache,
  fetchServerLibrary,
  libraryQueryKey,
  mergeGuestLibrary,
  readGuestLibrary,
  readUserLibraryCache,
  toggleGuestItem,
  toggleServerItem,
  type LibraryData,
  type LibraryItemType,
} from '@/lib/library'

interface LibraryContextValue {
  books: Book[]
  articles: Article[]
  isBookmarked: (type: 'book' | 'article', id: string | number) => boolean
  /** Adds/removes the book. Signed in: optimistic, reverted if the server rejects it. */
  toggleBook: (book: Book) => Promise<void>
  toggleArticle: (article: Article) => Promise<void>
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined)

const SERVER_LIBRARY_STALE_TIME = 5 * 60_000

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const userId = useSessionUserId()

  const guest = useQuery({
    queryKey: libraryQueryKey(GUEST_OWNER),
    queryFn: readGuestLibrary,
    enabled: !userId,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const server = useQuery({
    // Disabled while signed out; the key must still differ from the guest list's.
    queryKey: libraryQueryKey(userId ?? 'signed-out'),
    queryFn: () => fetchServerLibrary(userId as string),
    enabled: Boolean(userId),
    staleTime: SERVER_LIBRARY_STALE_TIME,
  })

  // Signed in: show the offline copy until the server answers, and merge guest bookmarks once.
  const previousUserId = useRef<string | null>(null)
  useEffect(() => {
    const previous = previousUserId.current
    previousUserId.current = userId
    if (previous && previous !== userId) void clearUserLibraryCache(previous) // signed out
    if (!userId) return
    const key = libraryQueryKey(userId)
    void readUserLibraryCache(userId).then((cached) => {
      // `updatedAt: 0` keeps it stale, so the server copy still replaces it.
      if (cached && !queryClient.getQueryData(key)) queryClient.setQueryData(key, cached, { updatedAt: 0 })
    })
    mergeGuestLibrary(queryClient, userId).catch(() => undefined)
  }, [queryClient, userId])

  const data: LibraryData = (userId ? server.data : guest.data) ?? EMPTY_LIBRARY
  const { books, articles } = data

  // Identity only changes when the set of bookmarked ids does (not on refetches with the same content).
  const membership = useMemo(
    () => [...books.map((b) => `book:${b.id}`), ...articles.map((a) => `article:${a.id}`)].sort().join('\n'),
    [books, articles],
  )
  const ids = useMemo(() => new Set(membership.split('\n')), [membership])
  const isBookmarked = useCallback((type: LibraryItemType, id: string | number) => ids.has(`${type}:${id}`), [ids])

  const toggle = useCallback(
    async (type: LibraryItemType, item: Book | Article) => {
      try {
        if (userId) await toggleServerItem(queryClient, userId, type, item)
        else await toggleGuestItem(queryClient, type, item)
      } catch (err) {
        // The optimistic change has been reverted; nothing else to surface here.
        if (__DEV__) console.warn('[library] toggle failed:', err)
      }
    },
    [queryClient, userId],
  )

  const toggleBook = useCallback((book: Book) => toggle('book', book), [toggle])
  const toggleArticle = useCallback((article: Article) => toggle('article', article), [toggle])

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
