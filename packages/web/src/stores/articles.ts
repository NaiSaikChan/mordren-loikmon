import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { articles as articlesApi } from '@loikmon/api'
import type { Article } from '@loikmon/api'

export const useArticlesStore = defineStore('articles', () => {
  const list    = ref<Article[]>([])
  const detail  = shallowRef<Article | null>(null)   // ← was undefined, must be null
  const loading = ref(false)
  const total   = shallowRef(0)

  async function fetchArticles(params?: Record<string, unknown>, append = false): Promise<number> {
    loading.value = true
    try {
      const res   = await articlesApi.fetchArticles(params)
      const body  = res.data as any
      const items: Article[] = body.articles ?? body.data?.articles ?? (Array.isArray(body) ? body : [])
      const t = body.total ?? body.data?.total ?? body.count ?? body.data?.count
      if (t != null) total.value = Number(t)
      list.value  = append ? [...list.value, ...items] : items
      return items.length
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string | number) {
    loading.value = true
    try {
      // 1. Check list cache first — avoids an extra API round-trip
      const cached = list.value.find(a => String(a.id) === String(id))
      if (cached) {
        detail.value = cached
        return
      }

      // 2. Call getarticle endpoint
      try {
        const res  = await articlesApi.getArticle(id)
        const body = res.data as any
        const found = body.article ?? body.data?.article ?? null
        if (found && found.id) {
          detail.value = found
          return
        }
      } catch { /* fallthrough to bulk fetch */ }

      // 3. Last resort: fetch all articles and find by id
      const res  = await articlesApi.fetchArticles()
      const body = res.data as any
      list.value  = body.articles ?? []
      detail.value = list.value.find(a => String(a.id) === String(id)) ?? null
    } finally {
      loading.value = false
    }
  }

  function setDetail(article: Article) {
    detail.value = article
  }

  return { list, detail, loading, total, fetchArticles, fetchDetail, setDetail }
})
