<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCategoriesStore } from '@/stores/categories'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import ArticlesTable from '@/components/articles/ArticlesTable.vue'
import Pagination from '@/components/shared/Pagination.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import { useArticlesList } from '@/composables/useArticlesList'

const { t } = useI18n()
const catStore = useCategoriesStore()
const auth = useAuthStore()
const library = useLibraryStore()
const {
  articles, page, pageSize, sortOrder, selectedCat,
  isLastPage, totalPages, loading, error, PAGE_SIZES,
  fetchPage, goToPage, changePageSize, changeCategory, toggleSort,
} = useArticlesList()

onMounted(async () => {
  await Promise.all([catStore.fetchCategories('article'), fetchPage()])
})

// Saved (🔖) state of each row comes from the server-side library.
watch(() => auth.isLoggedIn, (loggedIn) => { if (loggedIn) void library.ensureLoaded() }, { immediate: true })
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('articles.title') }}</h1>

    <!-- Category filter bar -->
    <div v-if="catStore.list.length" class="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
      <button
        type="button"
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selectedCat === 0 ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300']"
        @click="changeCategory(0)"
      >{{ t('common.all') }}</button>
      <button
        v-for="cat in catStore.list"
        :key="cat.id"
        type="button"
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selectedCat === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300']"
        @click="changeCategory(cat.id)"
      >{{ cat.name }}</button>
    </div>

    <LoadingSpinner v-if="loading && !articles.length" />

    <div v-else-if="error && !articles.length" class="card p-10 text-center text-gray-500 dark:text-gray-400">
      <p class="mb-4">{{ t('articles.loadError') }}</p>
      <button type="button" class="btn-primary" @click="fetchPage">{{ t('common.retry') }}</button>
    </div>

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
        :total-pages="totalPages"
        :loading="loading"
        :page-sizes="PAGE_SIZES"
        @update:page="goToPage"
        @update:page-size="changePageSize"
      />
    </template>
  </div>
</template>
