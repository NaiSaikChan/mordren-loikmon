<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCategoriesStore } from '@/stores/categories'
import ArticlesTable from '@/components/articles/ArticlesTable.vue'
import Pagination from '@/components/shared/Pagination.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import { useArticlesList } from '@/composables/useArticlesList'

const { t } = useI18n()
const catStore = useCategoriesStore()
const {
  articles, page, pageSize, sortOrder, selectedCat,
  isLastPage, totalPages, loading, PAGE_SIZES,
  fetchPage, goToPage, changePageSize, changeCategory, toggleSort,
} = useArticlesList()

// Some article API responses do not provide a total count.
// Fallback keeps page numbers visible (books-like pagination UX).
const paginationTotalPages = computed(() => {
  if (totalPages.value > 0) return totalPages.value
  if (isLastPage.value) return Math.max(1, page.value)
  return page.value + 1
})

onMounted(async () => {
  await Promise.all([catStore.fetchCategories(), fetchPage()])
})
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('articles.title') }}</h1>

    <!-- Category filter bar -->
    <div v-if="catStore.list.length" class="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
      <button
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selectedCat === 0 ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300']"
        @click="changeCategory(0)"
      >All</button>
      <button
        v-for="cat in catStore.list"
        :key="cat.id"
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selectedCat === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300']"
        @click="changeCategory(cat.id)"
      >{{ cat.name }}</button>
    </div>

    <LoadingSpinner v-if="loading && !articles.length" />

    <template v-else>
      <ArticlesTable
        :articles="articles"
        :sort-order="sortOrder"
        @toggle-sort="toggleSort"
      />

      <Pagination
        :page="page"
        :page-size="pageSize"
        :is-last-page="isLastPage"
        :total-pages="paginationTotalPages"
        :loading="loading"
        :page-sizes="PAGE_SIZES"
        @update:page="goToPage"
        @update:page-size="changePageSize"
      />
    </template>
  </div>
</template>

