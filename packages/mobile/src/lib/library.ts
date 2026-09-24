import type { QueryClient } from '@tanstack/react-query'
import { errorCode, library as libraryApi } from '@loikmon/api'
import type { Article, Book } from '@loikmon/api'
import { storage } from '@/services/storage'

/**
 * Bookmarks ("My library").
 *  - Signed in: the server library (`GET /library`, `PUT|DELETE /library/:type/:id`)
 *    is the source of truth; a copy is kept per user id for offline viewing.
 *  - Signed out: a device-local guest list, merged into the account on sign-in.
 */

export type LibraryItemType = 'book' | 'article'

export interface LibraryData {
  books: Book[]
  articles: Article[]
}

export const EMPTY_LIBRARY: LibraryData = { books: [], articles: [] }

/** Guest list keys (the same keys older builds used for every bookmark on the device). */
export const GUEST_BOOKS_KEY = 'library_books'
export const GUEST_ARTICLES_KEY = 'library_articles'

/** Offline copy of a signed-in user's server library. */
export const userLibraryCacheKey = (userId: string) => `library_cache:${userId}`

export const GUEST_OWNER = 'guest'
/** React Query key: `owner` is a user id, or `guest`. */
export const libraryQueryKey = (owner: string) => ['library', owner] as const

const sameId = (a: { id: unknown }, id: string | number) => String(a.id) === String(id)

export function hasItem(data: LibraryData, type: LibraryItemType, id: string | number): boolean {
  const list: { id: unknown }[] = type === 'book' ? data.books : data.articles
  return list.some((item) => sameId(item, id))
}

/** `data` with `item` present (prepended) or absent. Returns `data` itself when nothing changes. */
export function setMembership(data: LibraryData, type: LibraryItemType, item: Book | Article, present: boolean): LibraryData {
  if (hasItem(data, type, item.id) === present) return data
  if (type === 'book') {
    const books = present ? [item as Book, ...data.books] : data.books.filter((b) => !sameId(b, item.id))
    return { ...data, books }
  }
  const articles = present ? [item as Article, ...data.articles] : data.articles.filter((a) => !sameId(a, item.id))
  return { ...data, articles }
}

export async function readGuestLibrary(): Promise<LibraryData> {
  const [books, articles] = await Promise.all([
    storage.getJSON<Book[]>(GUEST_BOOKS_KEY).catch(() => null),
    storage.getJSON<Article[]>(GUEST_ARTICLES_KEY).catch(() => null),
  ])
  return { books: Array.isArray(books) ? books : [], articles: Array.isArray(articles) ? articles : [] }
}

export async function writeGuestLibrary(data: LibraryData): Promise<void> {
  await Promise.all([storage.setJSON(GUEST_BOOKS_KEY, data.books), storage.setJSON(GUEST_ARTICLES_KEY, data.articles)])
}

export async function readUserLibraryCache(userId: string): Promise<LibraryData | null> {
  const cached = await storage.getJSON<LibraryData>(userLibraryCacheKey(userId)).catch(() => null)
  if (!cached || !Array.isArray(cached.books) || !Array.isArray(cached.articles)) return null
  return cached
}

export async function writeUserLibraryCache(userId: string, data: LibraryData): Promise<void> {
  await storage.setJSON(userLibraryCacheKey(userId), data).catch(() => undefined)
}

export async function clearUserLibraryCache(userId: string): Promise<void> {
  await storage.remove(userLibraryCacheKey(userId)).catch(() => undefined)
}

export async function fetchServerLibrary(userId: string): Promise<LibraryData> {
  const { data } = await libraryApi.list()
  const next = { books: data.books ?? [], articles: data.articles ?? [] }
  void writeUserLibraryCache(userId, next)
  return next
}

/**
 * Toggle on the signed-in user's server library: optimistic cache update,
 * then the request; on failure only *this* item's change is reverted, so
 * concurrent toggles of other items survive.
 */
export async function toggleServerItem(
  queryClient: QueryClient,
  userId: string,
  type: LibraryItemType,
  item: Book | Article,
): Promise<void> {
  const key = libraryQueryKey(userId)
  // A cancelled initial load leaves the query idle: refetch it afterwards.
  const wasFetching = queryClient.isFetching({ queryKey: key }) > 0
  await queryClient.cancelQueries({ queryKey: key })
  const base = queryClient.getQueryData<LibraryData>(key) ?? EMPTY_LIBRARY
  const adding = !hasItem(base, type, item.id)
  queryClient.setQueryData<LibraryData>(key, (current) => setMembership(current ?? EMPTY_LIBRARY, type, item, adding))

  let failed = false
  try {
    if (adding) await libraryApi.add(type, item.id)
    else await libraryApi.remove(type, item.id)
    const latest = queryClient.getQueryData<LibraryData>(key)
    if (latest) await writeUserLibraryCache(userId, latest)
  } catch (err) {
    failed = true
    queryClient.setQueryData<LibraryData>(key, (current) => setMembership(current ?? EMPTY_LIBRARY, type, item, !adding))
    throw err
  } finally {
    if (failed || wasFetching) void queryClient.invalidateQueries({ queryKey: key })
  }
}

/**
 * Toggle on the guest list. Waits for the stored list to be read first, so a
 * tap during start-up is applied on top of the stored bookmarks instead of
 * being overwritten by them.
 */
export async function toggleGuestItem(queryClient: QueryClient, type: LibraryItemType, item: Book | Article): Promise<void> {
  const key = libraryQueryKey(GUEST_OWNER)
  await queryClient.ensureQueryData({ queryKey: key, queryFn: readGuestLibrary })
  // Read again after the await: other toggles may have run meanwhile.
  const base = queryClient.getQueryData<LibraryData>(key) ?? EMPTY_LIBRARY
  const next = setMembership(base, type, item, !hasItem(base, type, item.id))
  queryClient.setQueryData(key, next)
  await writeGuestLibrary(next)
}

const merging = new Map<string, Promise<void>>()

/**
 * Moves the guest bookmarks into the account that just signed in (once: the
 * merged items leave the guest list, so they never carry over to another account).
 * Items the server no longer has are dropped; items that failed transiently stay
 * in the guest list for the next sign-in.
 */
export function mergeGuestLibrary(queryClient: QueryClient, userId: string): Promise<void> {
  const running = merging.get(userId)
  if (running) return running
  const task = (async () => {
    const guest = await readGuestLibrary()
    if (guest.books.length === 0 && guest.articles.length === 0) return
    const entries: [LibraryItemType, Book | Article][] = [
      ...guest.books.map((b): [LibraryItemType, Book] => ['book', b]),
      ...guest.articles.map((a): [LibraryItemType, Article] => ['article', a]),
    ]
    let remaining = guest
    let added = 0
    for (const [type, item] of entries) {
      try {
        await libraryApi.add(type, item.id)
        added++
        remaining = setMembership(remaining, type, item, false)
      } catch (err) {
        if (errorCode(err) === 'NOT_FOUND' || errorCode(err) === 'VALIDATION_ERROR') {
          remaining = setMembership(remaining, type, item, false)
        } else if (errorCode(err) === 'UNAUTHORIZED' || errorCode(err) === 'LOGIN_REQUIRED') {
          break // session ended mid-merge: keep the rest for next time
        }
      }
    }
    await writeGuestLibrary(remaining)
    queryClient.setQueryData(libraryQueryKey(GUEST_OWNER), remaining)
    if (added > 0) await queryClient.invalidateQueries({ queryKey: libraryQueryKey(userId) })
  })().finally(() => merging.delete(userId))
  merging.set(userId, task)
  return task
}
