<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useCategoriesStore } from '@/stores/categories'
import BookCard from '@/components/shared/BookCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import Pagination from '@/components/shared/Pagination.vue'

const { t } = useI18n()
const route = useRoute()
const store = useBooksStore()
const catStore = useCategoriesStore()

const PAGE_SIZE = 18
const page = ref(1)
const selectedCat = ref<string>((route.query.cat as string) ?? '')
const sortBy = ref<'date' | 'views'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')
const accumulatedBooks = ref<typeof store.list>([])  // Keep our own accumulated list
const nextAPIPage = ref(0)  // Track next page to fetch from API
const isLoading = ref(false)  // Track if we're fetching more books

const sortedBooks = computed(() => {
  let filtered = accumulatedBooks.value
  
  // Client-side category filter using category ID
  if (selectedCat.value) {
    filtered = filtered.filter(book => {
      const bookCat = String(book.category ?? book.cat ?? '')
      return bookCat === selectedCat.value
    })
  }
  
  // Apply sort based on sortBy
  return [...filtered].sort((a, b) => {
    if (sortBy.value === 'views') {
      // Sort by views (popularity)
      const viewsA = Number(a.views ?? a.total_views ?? 0)
      const viewsB = Number(b.views ?? b.total_views ?? 0)
      return sortOrder.value === 'asc' ? viewsA - viewsB : viewsB - viewsA
    } else {
      // Sort by date (default)
      const parseDate = (book: typeof a) =>
        new Date((book.published_at ?? book.created_at ?? book.date ?? '') as string).getTime()
      return sortOrder.value === 'asc' ? parseDate(a) - parseDate(b) : parseDate(b) - parseDate(a)
    }
  })
})

// Paginate the filtered books
const paginatedBooks = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  return sortedBooks.value.slice(start, end)
})

const totalPages = computed(() =>
  sortedBooks.value.length > 0 ? Math.ceil(sortedBooks.value.length / PAGE_SIZE) : 0
)

const isLastPage = computed(() => {
  if (sortedBooks.value.length === 0) return true
  return page.value >= totalPages.value
})

async function loadMoreFromAPI() {
  isLoading.value = true
  try {
    const params: Record<string, unknown> = {
      page: String(nextAPIPage.value),
      limit: PAGE_SIZE * 3,
    }
    const count = await store.fetchBooks(params)
    
    // Deduplicate: only add books we haven't seen before
    const seenIds = new Set(accumulatedBooks.value.map(b => String(b.id)))
    const newBooks = store.list.filter(b => !seenIds.has(String(b.id)))
    accumulatedBooks.value = [...accumulatedBooks.value, ...newBooks]
    
    nextAPIPage.value += 1
    return count
  } finally {
    isLoading.value = false
  }
}

async function ensureEnoughBooks() {
  // Fetch 2 pages of books to ensure we have enough filtered results
  await loadMoreFromAPI()  // page 0
  await loadMoreFromAPI()  // page 1
}

async function loadBooks(reset = true) {
  if (reset) { 
    page.value = 1
    nextAPIPage.value = 0
    accumulatedBooks.value = []
  }
  await ensureEnoughBooks()
}

function goToPage(p: number) {
  page.value = p
}

function toggleSort() {
  // Cycle through: date desc → views desc → date asc → views asc → back to date desc
  if (sortBy.value === 'date' && sortOrder.value === 'desc') {
    sortBy.value = 'views'
    sortOrder.value = 'desc'
  } else if (sortBy.value === 'views' && sortOrder.value === 'desc') {
    sortBy.value = 'date'
    sortOrder.value = 'asc'
  } else if (sortBy.value === 'date' && sortOrder.value === 'asc') {
    sortBy.value = 'views'
    sortOrder.value = 'asc'
  } else {
    // Reset to initial state
    sortBy.value = 'date'
    sortOrder.value = 'desc'
  }
}

// Watch for category changes and reload books
watch(selectedCat, () => {
  loadBooks(true)  // Reset and reload when category changes
})

// Auto-load more books when we need more filtered results for pagination
watch(page, async () => {
  const neededBooks = page.value * PAGE_SIZE
  const hasEnough = sortedBooks.value.length >= neededBooks
  
  if (!hasEnough && !store.loading) {
    await loadMoreFromAPI()
  }
}, { immediate: false })

onMounted(async () => {
  await Promise.all([catStore.fetchCategories(), loadBooks()])
})
</script>

<template>
  <div class="page-wrapper">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('books.title') }}</h1>
      <button
        class="px-3 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-800 transition-colors"
        @click="toggleSort"
        :title="`Sort by ${sortBy === 'date' ? 'date' : 'views'} (${sortOrder})`"
      >
        <span v-if="sortBy === 'date'">Sort by Date {{ sortOrder === 'desc' ? 'newest' : 'oldest' }}</span>
        <span v-else>Sort by Popular {{ sortOrder === 'desc' ? 'most popular' : 'least popular' }}</span>
      </button>
    </div>

    <!-- Category filter chips -->
    <div v-if="catStore.list.length" class="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
      <button
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          !selectedCat ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700']"
        @click="selectedCat = ''; loadBooks()">
        All
      </button>
      <button v-for="cat in catStore.list" :key="cat.id"
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selectedCat === String(cat.id) ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700']"
        @click="selectedCat = String(cat.id); loadBooks()">
        {{ cat.name }}
      </button>
    </div>

    <LoadingSpinner v-if="store.loading && !accumulatedBooks.length" />
    <EmptyState v-else-if="!store.loading && !accumulatedBooks.length" icon="📚" :title="t('common.notFound')" />

    <div v-else>
      <div class="content-grid">
        <BookCard v-for="book in paginatedBooks" :key="book.id" :book="book" />
      </div>

      <Pagination
        :page="page"
        :is-last-page="isLastPage"
        :total-pages="totalPages"
        :loading="store.loading"
        @update:page="goToPage"
      />
    </div>
  </div>
</template>

