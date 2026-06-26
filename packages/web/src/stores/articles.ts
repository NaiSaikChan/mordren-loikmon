import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { articles as articlesApi } from '@loikmon/api'
import type { Article } from '@loikmon/api'

export const useArticlesStore = defineStore('articles', () => {
  const list = ref<Article[]>([])
  const detail = shallowRef<Article | undefined>(undefined)
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

  async function fetchDetail(id: string | number) {
    loading.value = true
    try {
      // Try getarticle endpoint first
      try {
        const res = await articlesApi.getArticle(id)
        const body = res.data as any
        const found = body.article ?? body.data?.article ?? undefined
        if (found && found.id) {
          detail.value = found
          loading.value = false
          return
        }
      } catch { /* fallthrough */ }

      // Fallback: find in list (already fetched), or fetch all and search
      let found = list.value.find(a => String(a.id) === String(id))
      if (!found) {
        const res = await articlesApi.fetchArticles()
        const body = res.data as any
        list.value = body.articles ?? []
        found = list.value.find(a => String(a.id) === String(id))
      }
      detail.value = found ?? undefined
    } finally {
      loading.value = false
    }
  }

  function setDetail(article: Article) {
    detail.value = article
  }

  return { list, detail, loading, fetchArticles, fetchDetail, setDetail }
})
