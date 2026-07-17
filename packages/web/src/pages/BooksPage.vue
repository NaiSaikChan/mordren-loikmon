<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useCategoriesStore } from '@/stores/categories'
import BookCard from '@/components/shared/BookCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import ArticlesPagination from '@/components/articles/ArticlesPagination.vue'

const { t } = useI18n()
const route = useRoute()
const store = useBooksStore()
const catStore = useCategoriesStore()

const PAGE_SIZE = 10
const page = ref(1)  // 1-indexed for display; API receives page - 1 (0-indexed)
const selectedCat = ref<string>((route.query.cat as string) ?? '')
const isLastPage = ref(false)

const totalPages = computed(() =>
  store.total > 0 ? Math.ceil(store.total / PAGE_SIZE) : 0
)

async function loadBooks(reset = true) {
  if (reset) { page.value = 1; isLastPage.value = false }
  const params: Record<string, unknown> = {
    page: String(page.value - 1),
    limit: PAGE_SIZE,
  }
  if (selectedCat.value) params.cat = selectedCat.value
  const count = await store.fetchBooks(params)
  isLastPage.value = count < PAGE_SIZE
}

function goToPage(p: number) {
  page.value = p
  loadBooks(false)
}

onMounted(async () => {
  await Promise.all([catStore.fetchCategories(), loadBooks()])
})
</script>

<template>
  <div class="page-wrapper">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('books.title') }}</h1>
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

    <LoadingSpinner v-if="store.loading && !store.list.length" />
    <EmptyState v-else-if="!store.loading && !store.list.length" icon="📚" :title="t('common.notFound')" />

    <div v-else>
      <div class="content-grid">
        <BookCard v-for="book in store.list" :key="book.id" :book="book" />
      </div>

      <ArticlesPagination
        :page="page"
        :is-last-page="isLastPage"
        :total-pages="totalPages"
        :loading="store.loading"
        @update:page="goToPage"
      />
    </div>
  </div>
</template>

