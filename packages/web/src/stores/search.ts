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
      const res = await searchApi.search(q)
      const body = res.data as any
      results.value = body.data ?? body ?? {}
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
