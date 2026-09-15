import { defineStore } from 'pinia'
import { ref } from 'vue'
import { search as searchApi } from '@loikmon/api'
import type { SearchResults } from '@loikmon/api'

export const useSearchStore = defineStore('search', () => {
  const results = ref<SearchResults | null>(null)
  const loading = ref(false)
  const query = ref('')
  let requestId = 0

  async function search(q: string) {
    const term = q.trim()
    if (!term) { results.value = null; return }
    query.value = term
    loading.value = true
    const id = ++requestId
    try {
      const { data } = await searchApi.search(term, { type: 'all', limit: 20 })
      if (id !== requestId) return
      results.value = {
        ...data,
        books: data.books ?? [],
        articles: data.articles ?? [],
        authors: data.authors ?? [],
      }
    } catch {
      if (id === requestId) results.value = null
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function clear() {
    requestId++
    results.value = null
    query.value = ''
    loading.value = false
  }

  return { results, loading, query, search, clear }
})
