import { defineStore } from 'pinia'
import { ref } from 'vue'
import { categories as catApi } from '@loikmon/api'
import type { Category } from '@loikmon/api'

export const useCategoriesStore = defineStore('categories', () => {
  const list = ref<Category[]>([])
  const loading = ref(false)

  /** Categories for books or articles; omit `type` for all. */
  async function fetchCategories(type?: 'book' | 'article') {
    loading.value = true
    try {
      const { data } = await catApi.fetchCategories(type)
      list.value = data.categories ?? []
    } catch {
      list.value = []
    } finally {
      loading.value = false
    }
    return list.value
  }

  return { list, loading, fetchCategories }
})
