import { computed, shallowRef } from 'vue'
import { useArticlesStore } from '@/stores/articles'

export const PAGE_SIZES = [10, 20, 30, 50, 100]

export function useArticlesList() {
  const store = useArticlesStore()

  const page        = shallowRef(1)              // 1-indexed for display; API uses 0-indexed
  const pageSize    = shallowRef(10)
  const sortOrder   = shallowRef<'asc' | 'desc'>('desc')
  const selectedCat = shallowRef(0)
  const isLastPage  = shallowRef(false)

  const totalPages = computed(() =>
    store.total > 0 ? Math.ceil(store.total / pageSize.value) : 0
  )

  // Sort the current fetched page client-side by date
  const sortedArticles = computed(() =>
    [...store.list].sort((a, b) => {
      const parse = (art: typeof a) =>
        new Date((art.articledate ?? art.created_at ?? art.date ?? '') as string).getTime()
      return sortOrder.value === 'asc' ? parse(a) - parse(b) : parse(b) - parse(a)
    })
  )

  async function fetchPage() {
    isLastPage.value = false
    const count = await store.fetchArticles({
      page: page.value - 1,          // convert to 0-indexed for API
      limit: pageSize.value,
      type: 1,
      query: '',
      category: selectedCat.value,
    })
    isLastPage.value = count < pageSize.value
  }

  function goToPage(p: number) {
    page.value = p
    fetchPage()
  }

  function changePageSize(size: number) {
    pageSize.value = size
    page.value = 1
    fetchPage()
  }

  function changeCategory(catId: number) {
    selectedCat.value = catId
    page.value = 1
    fetchPage()
  }

  function toggleSort() {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  }

  return {
    articles: sortedArticles,
    page,
    pageSize,
    sortOrder,
    selectedCat,
    isLastPage,
    totalPages,
    loading: computed(() => store.loading),
    PAGE_SIZES,
    fetchPage,
    goToPage,
    changePageSize,
    changeCategory,
    toggleSort,
  }
}
