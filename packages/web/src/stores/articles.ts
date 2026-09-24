import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { articles as articlesApi, errorCode } from '@loikmon/api'
import type { Article, ArticleDetail, ArticleQuery, Pagination } from '@loikmon/api'

export const useArticlesStore = defineStore('articles', () => {
  const list        = ref<Article[]>([])
  const pagination  = shallowRef<Pagination | null>(null)
  const total       = shallowRef(0)
  const detail      = shallowRef<ArticleDetail | null>(null)
  const loading     = ref(false)
  const detailError = ref<string | null>(null)

  /** Server-side filtered, 1-based page of articles (without bodies). */
  async function fetchArticles(params: ArticleQuery = {}, append = false) {
    loading.value = true
    try {
      const { data } = await articlesApi.fetchArticles(params)
      const items = data.articles ?? []
      list.value = append ? [...list.value, ...items] : items
      total.value = Number(data.total ?? data.pagination?.total ?? list.value.length)
      pagination.value = data.pagination ?? null
      return data
    } finally {
      loading.value = false
    }
  }

  /**
   * Always asks the server: list items carry no body, and only the detail
   * endpoint knows whether the viewer may read `content` / `audio_url`.
   */
  async function fetchDetail(id: string | number) {
    loading.value = true
    detailError.value = null
    try {
      const { data } = await articlesApi.getArticle(id)
      detail.value = data.article ?? null
    } catch (err) {
      detail.value = null
      detailError.value = errorCode(err)
    } finally {
      loading.value = false
    }
    return detail.value
  }

  function setInLibrary(inLibrary: boolean) {
    if (detail.value) detail.value = { ...detail.value, in_library: inLibrary }
  }

  return { list, pagination, total, detail, loading, detailError, fetchArticles, fetchDetail, setInLibrary }
})
