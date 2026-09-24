import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@loikmon/api'
import {
  GUEST_ARTICLES_KEY,
  GUEST_BOOKS_KEY,
  GUEST_OWNER,
  fetchServerLibrary,
  hasItem,
  libraryQueryKey,
  mergeGuestLibrary,
  readGuestLibrary,
  readUserLibraryCache,
  setMembership,
  toggleGuestItem,
  toggleServerItem,
  type LibraryData,
} from '@/lib/library'

const mockList = jest.fn()
const mockAdd = jest.fn()
const mockRemove = jest.fn()

jest.mock('@loikmon/api', () => ({
  ...jest.requireActual('@loikmon/api'),
  library: {
    list: (...args: unknown[]) => mockList(...args),
    add: (...args: unknown[]) => mockAdd(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}))

const book = (id: number) => ({ id, title: `Book ${id}` }) as never
const article = (id: number) => ({ id, title: `Article ${id}` }) as never

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  mockAdd.mockResolvedValue({ data: { status: 'ok', in_library: true } })
  mockRemove.mockResolvedValue({ data: { status: 'ok', in_library: false } })
})

describe('setMembership', () => {
  it('adds (prepended), removes, and returns the same object when nothing changes', () => {
    const empty: LibraryData = { books: [], articles: [] }
    const one = setMembership(empty, 'book', book(1), true)
    expect(one.books.map((b) => b.id)).toEqual([1])
    const two = setMembership(one, 'book', book(2), true)
    expect(two.books.map((b) => b.id)).toEqual([2, 1])
    expect(setMembership(two, 'book', book(2), true)).toBe(two)
    expect(hasItem(setMembership(two, 'book', { id: '1' } as never, false), 'book', 1)).toBe(false)
    expect(setMembership(empty, 'article', article(5), true).articles).toHaveLength(1)
  })
})

describe('guest library', () => {
  it('a toggle made before the stored list is read is applied on top of it (no hydration race)', async () => {
    await AsyncStorage.setItem(GUEST_BOOKS_KEY, JSON.stringify([book(1)]))
    const client = newClient()
    // Two taps before anything was hydrated.
    await Promise.all([toggleGuestItem(client, 'book', book(2)), toggleGuestItem(client, 'article', article(3))])
    const data = client.getQueryData<LibraryData>(libraryQueryKey(GUEST_OWNER))!
    expect(data.books.map((b) => b.id)).toEqual([2, 1])
    expect(data.articles.map((a) => a.id)).toEqual([3])
    expect(await readGuestLibrary()).toEqual(data)
  })

  it('toggling twice removes the bookmark again', async () => {
    const client = newClient()
    await toggleGuestItem(client, 'book', book(1))
    await toggleGuestItem(client, 'book', book(1))
    expect((await readGuestLibrary()).books).toEqual([])
  })
})

describe('server library (signed in)', () => {
  it('keeps an offline copy per user id', async () => {
    mockList.mockResolvedValue({ data: { status: 'ok', books: [book(1)], articles: [] } })
    await fetchServerLibrary('user-a')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((await readUserLibraryCache('user-a'))?.books.map((b) => b.id)).toEqual([1])
    expect(await readUserLibraryCache('user-b')).toBeNull()
  })

  it('updates optimistically before the server answers', async () => {
    const client = newClient()
    client.setQueryData(libraryQueryKey('u1'), { books: [], articles: [] })
    let resolveAdd!: () => void
    mockAdd.mockReturnValue(new Promise<void>((resolve) => (resolveAdd = resolve)))
    const pending = toggleServerItem(client, 'u1', 'book', book(7))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(hasItem(client.getQueryData<LibraryData>(libraryQueryKey('u1'))!, 'book', 7)).toBe(true)
    resolveAdd()
    await pending
    expect(mockAdd).toHaveBeenCalledWith('book', 7)
    expect((await readUserLibraryCache('u1'))?.books.map((b) => b.id)).toEqual([7])
  })

  it('rolls back only the failed item, keeping concurrent toggles', async () => {
    const client = newClient()
    client.setQueryData(libraryQueryKey('u1'), { books: [book(1)], articles: [] })
    mockRemove.mockRejectedValueOnce(new ApiError('offline', 0, 'NETWORK_ERROR'))
    const failing = toggleServerItem(client, 'u1', 'book', book(1)) // remove → fails
    const succeeding = toggleServerItem(client, 'u1', 'book', book(2)) // add → ok
    await expect(failing).rejects.toBeInstanceOf(ApiError)
    await succeeding
    const data = client.getQueryData<LibraryData>(libraryQueryKey('u1'))!
    expect(hasItem(data, 'book', 1)).toBe(true) // restored
    expect(hasItem(data, 'book', 2)).toBe(true) // untouched by the rollback
  })
})

describe('mergeGuestLibrary', () => {
  it('moves guest bookmarks to the account once and empties the guest list', async () => {
    await AsyncStorage.setItem(GUEST_BOOKS_KEY, JSON.stringify([book(1), book(2)]))
    await AsyncStorage.setItem(GUEST_ARTICLES_KEY, JSON.stringify([article(3)]))
    const client = newClient()
    await mergeGuestLibrary(client, 'user-a')
    expect(mockAdd.mock.calls).toEqual([
      ['book', 1],
      ['book', 2],
      ['article', 3],
    ])
    expect(await readGuestLibrary()).toEqual({ books: [], articles: [] })

    // A second account signing in later gets nothing from the first one.
    mockAdd.mockClear()
    await mergeGuestLibrary(client, 'user-b')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('drops items the server no longer has, keeps transient failures for next time', async () => {
    await AsyncStorage.setItem(GUEST_BOOKS_KEY, JSON.stringify([book(1), book(2), book(3)]))
    mockAdd
      .mockResolvedValueOnce({ data: { status: 'ok' } })
      .mockRejectedValueOnce(new ApiError('gone', 404, 'NOT_FOUND'))
      .mockRejectedValueOnce(new ApiError('offline', 0, 'NETWORK_ERROR'))
    await mergeGuestLibrary(newClient(), 'user-a')
    expect((await readGuestLibrary()).books.map((b) => b.id)).toEqual([3])
  })

  it('runs once even when triggered concurrently', async () => {
    await AsyncStorage.setItem(GUEST_BOOKS_KEY, JSON.stringify([book(1)]))
    const client = newClient()
    await Promise.all([mergeGuestLibrary(client, 'user-a'), mergeGuestLibrary(client, 'user-a')])
    expect(mockAdd).toHaveBeenCalledTimes(1)
  })
})
