import { defineStore } from 'pinia'
import { ref } from 'vue'
import { search as searchApi } from '@loikmon/api'
import type { SearchResults } from '@loikmon/api'

export const useSearchStore = defineStore('search', () => {
  const results = ref<SearchResults | null>(null)
  const loading = ref(false)
  const query = ref('')

  async function search(q: string) {
    if (!q.trim()) { results.value = null; return }
    query.value = q
    loading.value = true
    try {
      // Fetch books (type=0) and articles (type=1) in parallel
      const [booksRes, articlesRes] = await Promise.all([
        searchApi.search(q, 0, 0),
        searchApi.search(q, 1, 0),
      ])
      const books  = (booksRes.data as any)?.search   ?? []
      const articles = (articlesRes.data as any)?.search ?? []
      results.value = { books, articles }
    } finally {
      loading.value = false
    }
  }

  function clear() {
    results.value = null
    query.value = ''
  }

  return { results, loading, query, search, clear }
})
