import { computed, shallowRef } from 'vue'
import { useArticlesStore } from '@/stores/articles'
import type { Article } from '@loikmon/api'

export const PAGE_SIZES = [10, 20, 30, 50, 100]

const API_PAGE_SIZE = 10
const MAX_ARTICLE_PAGES = 100
const articleListCache = new Map<number, Article[]>()

export function clearArticleListCache() {
  articleListCache.clear()
}

export function getArticleDateTimestamp(article: Article): number | null {
  const raw = article.articledate ?? article.updated_at ?? article.created_at ?? article.date
  if (!raw) return null
  const timestamp = new Date(raw as string).getTime()
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

export function useArticlesList() {
  const store = useArticlesStore()

  const page        = shallowRef(1)              // 1-indexed for display; API uses 0-indexed
  const pageSize    = shallowRef(10)
  const sortOrder   = shallowRef<'asc' | 'desc'>('desc')
  const selectedCat = shallowRef(0)
  const allArticles = shallowRef<Article[]>(articleListCache.get(0) ?? [])
  const loadingAll  = shallowRef(false)
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
      return
    }

    const currentLoadId = ++loadId
    const byId = new Map<string | number, Article>()
    loadingAll.value = true

    try {
      for (let apiPage = 0; apiPage < MAX_ARTICLE_PAGES; apiPage += 1) {
        const count = await store.fetchArticles({
          page: apiPage,
          limit: API_PAGE_SIZE,
          type: 1,
          query: '',
          category: categoryKey,
        })

        if (currentLoadId !== loadId) return

        const batch = [...store.list]
        if (count === 0 || batch.length === 0) break

        let added = 0
        for (const article of batch) {
          if (!byId.has(article.id)) {
            byId.set(article.id, article)
            added += 1
          }
        }

        if (added === 0) break
      }

      if (currentLoadId === loadId) {
        const nextArticles = Array.from(byId.values())
        articleListCache.set(categoryKey, nextArticles)
        allArticles.value = nextArticles
      }
    } finally {
      if (currentLoadId === loadId) loadingAll.value = false
    }
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
    fetchPage()
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
    loading: computed(() => store.loading || loadingAll.value),
    PAGE_SIZES,
    fetchPage,
    goToPage,
    changePageSize,
    changeCategory,
    toggleSort,
  }
}
