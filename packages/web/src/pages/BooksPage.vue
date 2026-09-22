<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { BookQuery } from '@loikmon/api'
import { useBooksStore } from '@/stores/books'
import { useCategoriesStore } from '@/stores/categories'
import BookCard from '@/components/shared/BookCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import Pagination from '@/components/shared/Pagination.vue'

type SortOption = NonNullable<BookQuery['sort']>

const { t } = useI18n()
const route = useRoute()
const store = useBooksStore()
const catStore = useCategoriesStore()

const PAGE_SIZE = 20
const page = ref(1)
const initialCat = Number(route.query.cat ?? route.query.category ?? 0)
const selectedCat = ref<number>(Number.isFinite(initialCat) && initialCat > 0 ? initialCat : 0)
const sortBy = ref<SortOption>('latest')
const failed = ref(false)
let requestId = 0

const sortOptions = computed<Array<{ value: SortOption; label: string }>>(() => [
  { value: 'latest', label: t('books.sortLatest') },
  { value: 'popular', label: t('books.sortPopular') },
  { value: 'rating', label: t('books.sortRating') },
  { value: 'title', label: t('books.sortTitle') },
])

const totalPages = computed(() => store.pagination?.total_pages ?? 1)
const isLastPage = computed(() => !store.pagination?.has_more)

/** Filtering, sorting and paging all happen on the server (1-based pages). */
async function loadBooks() {
  const id = ++requestId
  failed.value = false
  const params: BookQuery = { page: page.value, limit: PAGE_SIZE, sort: sortBy.value }
  if (selectedCat.value > 0) params.category = selectedCat.value
  try {
    await store.fetchBooks(params)
  } catch {
    if (id === requestId) {
      failed.value = true
      store.list = []
    }
  }
}

function selectCategory(catId: number) {
  if (selectedCat.value === catId) return
  selectedCat.value = catId
  page.value = 1
}

function goToPage(p: number) {
  page.value = Math.max(1, Math.min(p, totalPages.value))
}

watch([selectedCat, sortBy], () => {
  if (page.value !== 1) page.value = 1
  else void loadBooks()
})
watch(page, () => {
  void loadBooks()
  window.dispatchEvent(new CustomEvent('loikmon:scroll-main-top'))
})

onMounted(() => {
  void catStore.fetchCategories('book')
  void loadBooks()
})
</script>

<template>
  <div class="page-wrapper">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('books.title') }}</h1>
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span>{{ t('common.sortBy') }}</span>
        <select v-model="sortBy" class="input h-9 py-1 text-sm w-auto">
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
    </div>

    <!-- Category filter chips -->
    <div v-if="catStore.list.length" class="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
      <button
        type="button"
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          !selectedCat ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700']"
        @click="selectCategory(0)">
        {{ t('common.all') }}
      </button>
      <button v-for="cat in catStore.list" :key="cat.id"
        type="button"
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selectedCat === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700']"
        @click="selectCategory(cat.id)">
        {{ cat.name }}
      </button>
    </div>

    <LoadingSpinner v-if="store.loading && !store.list.length" />
    <div v-else-if="failed" class="card p-10 text-center text-gray-500 dark:text-gray-400">
      <p class="mb-4">{{ t('common.error') }}</p>
      <button type="button" class="btn-primary" @click="loadBooks">{{ t('common.retry') }}</button>
    </div>
    <EmptyState v-else-if="!store.loading && !store.list.length" icon="📚" :title="t('books.noBooks')" />

    <div v-else :class="{ 'opacity-60 transition-opacity': store.loading }">
      <div class="content-grid">
        <BookCard v-for="book in store.list" :key="book.id" :book="book" />
      </div>

      <Pagination
        v-if="totalPages > 1"
        :page="page"
        :is-last-page="isLastPage"
        :total-pages="totalPages"
        :loading="store.loading"
        @update:page="goToPage"
      />
    </div>
  </div>
</template>
