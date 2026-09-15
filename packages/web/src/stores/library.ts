import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { library as libraryApi } from '@loikmon/api'
import type { Article, Book, Id, ItemType } from '@loikmon/api'
import { useAuthStore } from './auth'

/** The signed-in user's saved books and articles (stored on the server, synced across devices). */
export const useLibraryStore = defineStore('library', () => {
  const books   = ref<Book[]>([])
  const articles = ref<Article[]>([])
  const loading = ref(false)
  const loaded  = ref(false)
  const saved   = ref<Record<ItemType, Set<number>>>({ book: new Set(), article: new Set() })
  let loadPromise: Promise<void> | null = null

  function reset() {
    books.value = []
    articles.value = []
    loaded.value = false
    saved.value = { book: new Set(), article: new Set() }
  }

  // Saved items belong to the user: forget them on sign-out or when another user signs in
  // (not on token rotation after a password change).
  const auth = useAuthStore()
  watch(() => auth.user?.id ?? null, (next, prev) => { if (prev !== null && next !== prev) reset() })

  async function fetch() {
    if (!auth.token) {
      reset()
      return
    }
    loading.value = true
    try {
      const { data } = await libraryApi.list()
      books.value = data.books ?? []
      articles.value = data.articles ?? []
      saved.value = {
        book: new Set(books.value.map((b) => Number(b.id))),
        article: new Set(articles.value.map((a) => Number(a.id))),
      }
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  /** Loads the library once per session (used to show saved state in lists). */
  function ensureLoaded(): Promise<void> {
    if (loaded.value || !auth.token) return Promise.resolve()
    loadPromise ??= fetch().catch(() => undefined).finally(() => { loadPromise = null })
    return loadPromise
  }

  function isSaved(type: ItemType, id: Id | string): boolean {
    return saved.value[type].has(Number(id))
  }

  /** Record the `in_library` flag returned by a detail endpoint. */
  function markSaved(type: ItemType, id: Id | string, inLibrary: boolean) {
    const next = new Set(saved.value[type])
    if (inLibrary) next.add(Number(id))
    else next.delete(Number(id))
    saved.value = { ...saved.value, [type]: next }
  }

  async function add(type: ItemType, id: Id | string) {
    await libraryApi.add(type, id)
    markSaved(type, id, true)
    // The list endpoint returns full objects; reload it next time the library is shown.
    loaded.value = false
  }

  async function remove(type: ItemType, id: Id | string) {
    await libraryApi.remove(type, id)
    markSaved(type, id, false)
    if (type === 'book') books.value = books.value.filter((b) => Number(b.id) !== Number(id))
    else articles.value = articles.value.filter((a) => Number(a.id) !== Number(id))
  }

  async function toggle(type: ItemType, id: Id | string): Promise<boolean> {
    if (isSaved(type, id)) {
      await remove(type, id)
      return false
    }
    await add(type, id)
    return true
  }

  return { books, articles, loading, loaded, fetch, ensureLoaded, isSaved, markSaved, add, remove, toggle, reset }
})
