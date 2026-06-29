<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useCategoriesStore } from '@/stores/categories'
import BookCard from '@/components/shared/BookCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const { t } = useI18n()
const route = useRoute()
const store = useBooksStore()
const catStore = useCategoriesStore()

const page = ref(0)
const selectedCat = ref<string>((route.query.cat as string) ?? '')
const isLastPage = ref(false)

async function loadBooks(reset = true) {
  if (reset) { page.value = 0; store.list = [] }
  const params: Record<string, unknown> = { page: String(page.value) }
  if (selectedCat.value) params.cat = selectedCat.value
  await store.fetchBooks(params)
}

async function loadMore() {
  page.value++
  const params: Record<string, unknown> = { page: String(page.value) }
  if (selectedCat.value) params.cat = selectedCat.value
  const prevLen = store.list.length
  await store.fetchBooks(params)
  if (store.list.length === prevLen) isLastPage.value = true
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
      <div v-if="!isLastPage" class="mt-8 text-center">
        <button class="btn-secondary" :disabled="store.loading" @click="loadMore">
          {{ store.loading ? t('common.loading') : t('common.more') }}
        </button>
      </div>
    </div>
  </div>
</template>
