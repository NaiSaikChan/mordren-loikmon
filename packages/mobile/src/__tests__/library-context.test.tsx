/**
 * @jest-environment jsdom
 */
import { createTestQueryClient, flush, renderHook, waitFor } from '@/test-utils/renderHook'
import { act, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LibraryProvider, useLibrary } from '@/context/LibraryContext'
import { GUEST_BOOKS_KEY, readUserLibraryCache, userLibraryCacheKey } from '@/lib/library'

let mockUserId: string | null = null
const mockList = jest.fn()
const mockAdd = jest.fn()
const mockRemove = jest.fn()

jest.mock('@/context/AuthContext', () => ({
  useSessionUserId: () => mockUserId,
}))

jest.mock('@loikmon/api', () => ({
  ...jest.requireActual('@loikmon/api'),
  library: {
    list: (...a: unknown[]) => mockList(...a),
    add: (...a: unknown[]) => mockAdd(...a),
    remove: (...a: unknown[]) => mockRemove(...a),
  },
}))

const book = (id: number) => ({ id, title: `Book ${id}` }) as never
const wrapper = ({ children }: { children: ReactNode }) => <LibraryProvider>{children}</LibraryProvider>

beforeEach(async () => {
  jest.clearAllMocks()
  mockUserId = null
  await AsyncStorage.clear()
  mockAdd.mockResolvedValue({ data: { status: 'ok' } })
  mockRemove.mockResolvedValue({ data: { status: 'ok' } })
})

describe('LibraryProvider', () => {
  it('signed out: device-local guest list; signed in: that user’s server library only', async () => {
    await AsyncStorage.setItem(GUEST_BOOKS_KEY, JSON.stringify([book(1)]))
    mockList.mockImplementation(async () => ({ data: { status: 'ok', books: [book(mockUserId === 'a' ? 10 : 20)], articles: [] } }))
    const client = createTestQueryClient()
    const { result, rerender } = await renderHook(() => useLibrary(), { client, wrapper })
    await waitFor(() => expect(result.current.books.map((b) => b.id)).toEqual([1]))
    expect(result.current.isBookmarked('book', 1)).toBe(true)

    // Sign in as A: guest bookmark is merged to A's server library, then A's list is shown.
    mockUserId = 'a'
    await rerender(undefined)
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('book', 1))
    await waitFor(() => expect(result.current.books.map((b) => b.id)).toEqual([10]))
    expect(result.current.isBookmarked('book', 1)).toBe(false)

    // Sign out: A's offline copy is removed; the (now empty) guest list is shown.
    mockUserId = null
    await rerender(undefined)
    await waitFor(() => expect(result.current.books).toEqual([]))
    await flush()
    expect(await AsyncStorage.getItem(userLibraryCacheKey('a'))).toBeNull()

    // Sign in as B: nothing of A's carries over, nothing is merged again.
    mockAdd.mockClear()
    mockUserId = 'b'
    await rerender(undefined)
    await waitFor(() => expect(result.current.books.map((b) => b.id)).toEqual([20]))
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('shows the per-user offline copy while the server is unreachable', async () => {
    await AsyncStorage.setItem(userLibraryCacheKey('a'), JSON.stringify({ books: [book(5)], articles: [] }))
    mockList.mockRejectedValue(new Error('offline'))
    mockUserId = 'a'
    const { result } = await renderHook(() => useLibrary(), { wrapper })
    await waitFor(() => expect(result.current.books.map((b) => b.id)).toEqual([5]))
  })

  it('keeps isBookmarked stable when a refetch returns the same bookmarks', async () => {
    mockList.mockImplementation(async () => ({ data: { status: 'ok', books: [book(1)], articles: [] } }))
    mockUserId = 'a'
    const client = createTestQueryClient()
    const { result } = await renderHook(() => useLibrary(), { client, wrapper })
    await waitFor(() => expect(result.current.books).toHaveLength(1))
    const first = result.current.isBookmarked
    await act(async () => {
      await client.refetchQueries({ queryKey: ['library', 'a'] })
    })
    await flush(10)
    expect(mockList).toHaveBeenCalledTimes(2)
    expect(result.current.isBookmarked).toBe(first)

    // A toggle changes membership → new identity, and is persisted to A's offline copy.
    await act(async () => {
      await result.current.toggleBook(book(2))
    })
    await waitFor(() => expect(result.current.isBookmarked('book', 2)).toBe(true))
    expect(result.current.isBookmarked).not.toBe(first)
    expect((await readUserLibraryCache('a'))?.books.map((b) => b.id)).toEqual([2, 1])
  })

  it('reverts an optimistic toggle the server rejects', async () => {
    mockList.mockResolvedValue({ data: { status: 'ok', books: [], articles: [] } })
    mockAdd.mockRejectedValue(new Error('offline'))
    mockUserId = 'a'
    const { result } = await renderHook(() => useLibrary(), { wrapper })
    await flush()
    await act(async () => {
      await result.current.toggleBook(book(3))
    })
    await waitFor(() => expect(result.current.isBookmarked('book', 3)).toBe(false))
  })
})
