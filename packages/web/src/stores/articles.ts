import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { articles as articlesApi } from '@loikmon/api'
import type { Article } from '@loikmon/api'

export const useArticlesStore = defineStore('articles', () => {
  const list = ref<Article[]>([])
  const detail = shallowRef<Article | null>(null)
  const loading = ref(false)

  async function fetchArticles(params?: Record<string, unknown>) {
    loading.value = true
    try {
      const res = await articlesApi.fetchArticles(params)
      const body = res.data as any
      list.value = body.articles ?? body.data?.articles ?? (Array.isArray(body) ? body : [])
    } finally {
      loading.value = false
    }
  }

  function setDetail(article: Article) {
    detail.value = article
  }

  return { list, detail, loading, fetchArticles, setDetail }
})
