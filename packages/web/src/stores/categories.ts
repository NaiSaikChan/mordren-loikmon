import { defineStore } from 'pinia'
import { ref } from 'vue'
import { categories as catApi } from '@loikmon/api'

export const useCategoriesStore = defineStore('categories', () => {
  const list = ref<any[]>([])
  const loading = ref(false)

  async function fetchCategories() {
    loading.value = true
    try {
      const res = await catApi.fetchCategories()
      const body = res.data as any
      list.value = body.categories ?? []
    } finally { loading.value = false }
  }

  async function fetchBooksByCategory(cat: string | number, sub?: string | number, page = 0) {
    const res = await catApi.fetchBooksByCategory(cat, sub, page)
    const body = res.data as any
    return body.books ?? []
  }

  return { list, loading, fetchCategories, fetchBooksByCategory }
})
