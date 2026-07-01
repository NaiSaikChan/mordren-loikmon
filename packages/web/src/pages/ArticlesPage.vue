<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useArticlesStore } from '@/stores/articles'
import { useCategoriesStore } from '@/stores/categories'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const { t } = useI18n()
const store = useArticlesStore()
const catStore = useCategoriesStore()

const page = ref(0)
const selectedCat = ref(0)
const isLastPage = ref(false)

async function loadArticles(reset = true) {
  if (reset) { page.value = 0; store.list = [] }
  const params: Record<string, unknown> = {
    page: page.value,
    type: 1,
    query: '',
    category: selectedCat.value
  }
  await store.fetchArticles(params)
}

async function loadMore() {
  page.value++
  const prevLen = store.list.length
  await store.fetchArticles({
    page: page.value,
    type: 1,
    query: '',
    category: selectedCat.value
  })
  if (store.list.length === prevLen) isLastPage.value = true
}

onMounted(async () => {
  await Promise.all([catStore.fetchCategories(), loadArticles()])
})
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('articles.title') }}</h1>

    <div v-if="catStore.list.length" class="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
      <button :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selectedCat === 0 ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300']"
        @click="selectedCat = 0; loadArticles()">All</button>
      <button v-for="cat in catStore.list" :key="cat.id"
        :class="['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selectedCat === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300']"
        @click="selectedCat = cat.id; loadArticles()">
        {{ cat.name }}
      </button>
    </div>

    <LoadingSpinner v-if="store.loading && !store.list.length" />
    <EmptyState v-else-if="!store.loading && !store.list.length" icon="📰" :title="t('common.notFound')" />

    <div v-else class="space-y-3">
      <ArticleCard v-for="article in store.list" :key="article.id" :article="article" />
    </div>

    <div v-if="!isLastPage && store.list.length" class="mt-6 text-center">
      <button class="btn-secondary" :disabled="store.loading" @click="loadMore">
        {{ store.loading ? t('common.loading') : t('common.more') }}
      </button>
    </div>
  </div>
</template>
