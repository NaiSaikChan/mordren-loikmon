/**
 * Library store — server-side saved books and articles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { makeArticle, makeBook, makeUser, response } from './helpers'

const mockList = vi.fn()
const mockAdd = vi.fn()
const mockRemove = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    library: {
      list: (...a: unknown[]) => mockList(...a),
      add: (...a: unknown[]) => mockAdd(...a),
      remove: (...a: unknown[]) => mockRemove(...a),
    },
  }
})

import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'

function signIn() {
  const auth = useAuthStore()
  auth.token = 'tok-1'
  auth.user = makeUser()
  return auth
}

describe('library store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('does not call the API when signed out', async () => {
    const store = useLibraryStore()
    await store.fetch()
    await store.ensureLoaded()
    expect(mockList).not.toHaveBeenCalled()
  })

  it('loads saved items and exposes their saved state', async () => {
    signIn()
    mockList.mockReturnValueOnce(response({ status: 'ok', books: [makeBook({ id: 7 })], articles: [makeArticle({ id: 11 })] }))
    const store = useLibraryStore()

    await store.fetch()

    expect(store.books).toHaveLength(1)
    expect(store.isSaved('book', 7)).toBe(true)
    expect(store.isSaved('article', '11')).toBe(true)
    expect(store.isSaved('book', 8)).toBe(false)
  })

  it('toggle() adds then removes an item on the server', async () => {
    signIn()
    mockAdd.mockReturnValueOnce(response({ status: 'ok', in_library: true }))
    mockRemove.mockReturnValueOnce(response({ status: 'ok', in_library: false }))
    const store = useLibraryStore()

    await expect(store.toggle('article', 11)).resolves.toBe(true)
    expect(mockAdd).toHaveBeenCalledWith('article', 11)
    expect(store.isSaved('article', 11)).toBe(true)

    await expect(store.toggle('article', 11)).resolves.toBe(false)
    expect(mockRemove).toHaveBeenCalledWith('article', 11)
    expect(store.isSaved('article', 11)).toBe(false)
  })

  it('forgets saved items when the user signs out', async () => {
    const auth = signIn()
    const store = useLibraryStore()
    store.markSaved('book', 7, true)

    auth.clearSession()
    await nextTick()

    expect(store.isSaved('book', 7)).toBe(false)
  })
})
