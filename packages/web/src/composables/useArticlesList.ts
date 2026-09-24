import { computed, shallowRef } from 'vue'
import { articles as articlesApi } from '@loikmon/api'
import type { Article, ArticleQuery } from '@loikmon/api'

export const PAGE_SIZES = [10, 20, 30, 50, 100]

/** The backend caps `limit` at 100; large pages keep the number of requests low. */
export const API_PAGE_SIZE = 100
/** Safety cap in case a server keeps reporting `has_more`. */
const MAX_ARTICLE_PAGES = 100

const articleListCache = new Map<number, Article[]>()
const articleListCacheComplete = new Set<number>()
const articleListBackgroundLoads = new Map<number, Promise<void>>()

export function clearArticleListCache() {
  articleListCache.clear()
  articleListCacheComplete.clear()
  articleListBackgroundLoads.clear()
}

export function getArticleDateTimestamp(article: Article): number | null {
  const raw = article.articledate ?? article.published_at ?? article.updated_at ?? article.created_at ?? article.date
  if (!raw) return null
  const timestamp = new Date(raw).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

export function compareArticlesByDate(a: Article, b: Article, order: 'asc' | 'desc'): number {
  const dateA = getArticleDateTimestamp(a)
  const dateB = getArticleDateTimestamp(b)

  if (dateA == null && dateB == null) return 0
  if (dateA == null) return 1
  if (dateB == null) return -1

  return order === 'asc' ? dateA - dateB : dateB - dateA
}

function fetchArticlesPage(categoryKey: number, page: number) {
  const params: ArticleQuery = { page, limit: API_PAGE_SIZE, sort: 'latest' }
  if (categoryKey > 0) params.category = categoryKey
  return articlesApi.fetchArticles(params)
}

/**
 * All articles of a category, sorted by date and paginated locally.
 *
 * The first server page renders immediately; the remaining pages are loaded
 * in the background (following `pagination.has_more`) and cached per category
 * so revisiting a category does not refetch it.
 */
export function useArticlesList() {
  const page        = shallowRef(1)
  const pageSize    = shallowRef(10)
  const sortOrder   = shallowRef<'asc' | 'desc'>('desc')
  const selectedCat = shallowRef(0)
  const allArticles = shallowRef<Article[]>(articleListCache.get(0) ?? [])
  const loadingAll  = shallowRef(false)
  const error       = shallowRef(false)
  let loadId = 0

  const totalPages = computed(() =>
    allArticles.value.length > 0 ? Math.ceil(allArticles.value.length / pageSize.value) : 1
  )

  const isLastPage = computed(() => page.value >= totalPages.value)

  // Sort all fetched article pages globally, then paginate locally.
  const sortedArticles = computed(() =>
    [...allArticles.value].sort((a, b) => compareArticlesByDate(a, b, sortOrder.value))
  )

  const pagedArticles = computed(() =>
    sortedArticles.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
  )

  async function fetchPage() {
    const categoryKey = selectedCat.value
    const cachedArticles = articleListCache.get(categoryKey)
    if (cachedArticles) {
      allArticles.value = cachedArticles
      if (!articleListCacheComplete.has(categoryKey)) {
        void continueLoading(categoryKey, cachedArticles, 2)
      }
      return
    }

    const currentLoadId = ++loadId
    loadingAll.value = true
    error.value = false

    try {
      const { data } = await fetchArticlesPage(categoryKey, 1)
      if (currentLoadId !== loadId) return

      const firstPage = data.articles ?? []
      articleListCache.set(categoryKey, firstPage)
      allArticles.value = firstPage

      // Render the first page immediately; complete the cache without blocking the UI.
      loadingAll.value = false
      if (data.pagination?.has_more && firstPage.length > 0) {
        void continueLoading(categoryKey, firstPage, 2)
      } else {
        articleListCacheComplete.add(categoryKey)
      }
    } catch {
      if (currentLoadId === loadId) {
        error.value = true
        allArticles.value = []
      }
    } finally {
      if (currentLoadId === loadId) loadingAll.value = false
    }
  }

  function continueLoading(categoryKey: number, initialArticles: Article[], startPage: number) {
    const existingLoad = articleListBackgroundLoads.get(categoryKey)
    if (existingLoad) return existingLoad

    const load = (async () => {
      const byId = new Map<number, Article>(initialArticles.map(article => [article.id, article]))
      // Resume after the pages already cached.
      let apiPage = Math.max(startPage, Math.floor(initialArticles.length / API_PAGE_SIZE) + 1)

      try {
        for (; apiPage <= MAX_ARTICLE_PAGES; apiPage += 1) {
          // Yield between pages so scrolling and interactions remain responsive.
          await new Promise<void>(resolve => setTimeout(resolve, 0))
          const { data } = await fetchArticlesPage(categoryKey, apiPage)
          const batch = data.articles ?? []

          for (const article of batch) byId.set(article.id, article)
          const nextArticles = Array.from(byId.values())
          articleListCache.set(categoryKey, nextArticles)
          if (selectedCat.value === categoryKey) allArticles.value = nextArticles

          if (!data.pagination?.has_more || batch.length === 0) {
            articleListCacheComplete.add(categoryKey)
            break
          }
        }
      } catch {
        // Keep what was loaded; the next visit resumes from the cache.
      } finally {
        articleListBackgroundLoads.delete(categoryKey)
      }
    })()

    articleListBackgroundLoads.set(categoryKey, load)
    return load
  }

  function goToPage(p: number) {
    page.value = Math.min(Math.max(1, p), totalPages.value)
  }

  function changePageSize(size: number) {
    pageSize.value = size
    page.value = 1
  }

  function changeCategory(catId: number) {
    selectedCat.value = catId
    page.value = 1
    return fetchPage()
  }

  function toggleSort() {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
    page.value = 1
  }

  return {
    articles: pagedArticles,
    page,
    pageSize,
    sortOrder,
    selectedCat,
    isLastPage,
    totalPages,
    error,
    loading: computed(() => loadingAll.value),
    PAGE_SIZES,
    fetchPage,
    goToPage,
    changePageSize,
    changeCategory,
    toggleSort,
  }
}
