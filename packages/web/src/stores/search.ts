import { defineStore } from 'pinia'
import { ref } from 'vue'
import { misc } from '@loikmon/api'
import type { SearchResult } from '@loikmon/api'

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const results = ref<SearchResult | null>(null)
  const loading = ref(false)

  async function search(q: string) {
    query.value = q
    if (!q.trim()) { results.value = null; return }
    loading.value = true
    try {
      const res = await misc.search(q)
      results.value = res.data.data ?? null
    } finally {
      loading.value = false
    }
  }

  function clear() { query.value = ''; results.value = null }

  return { query, results, loading, search, clear }
})
