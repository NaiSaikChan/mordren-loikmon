<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSearchStore } from '@/stores/search'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import AuthorCard from '@/components/shared/AuthorCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const route = useRoute()
const store = useSearchStore()
const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))

watch(
  query,
  (q) => {
    if (q) store.search(q)
    else store.clear()
  },
  { immediate: true },
)
</script>

<template>
  <div class="page-wrapper">
    <div v-if="query" class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
        {{ t('search.results') }}
      </p>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">
        “{{ query }}”
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {{ t('search.useTopBarHint') }}
      </p>
    </div>

    <LoadingSpinner v-if="store.loading" />

    <div v-else-if="store.results">
      <section v-if="store.results.books?.length" class="mb-8">
        <h2 class="section-title">📚 Books</h2>
        <div class="content-grid">
          <BookCard v-for="b in store.results.books" :key="b.id" :book="b" />
        </div>
      </section>

      <section v-if="store.results.articles?.length" class="mb-8">
        <h2 class="section-title">📰 Articles</h2>
        <div class="space-y-3">
          <ArticleCard v-for="a in store.results.articles" :key="a.id" :article="a" />
        </div>
      </section>

      <section v-if="store.results.authors?.length" class="mb-8">
        <h2 class="section-title">✍️ Authors</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AuthorCard v-for="a in store.results.authors" :key="a.id" :author="a" />
        </div>
      </section>

      <div v-if="!store.loading && !store.results.books?.length && !store.results.articles?.length && !store.results.authors?.length"
        class="text-center py-16 text-gray-400">
        <div class="text-5xl mb-3">🔍</div>
        <p>{{ t('search.noResults', { query }) }}</p>
      </div>
    </div>

    <div v-else-if="!query" class="text-center py-16 text-gray-400">
      <div class="text-5xl mb-3">🔍</div>
      <p class="font-medium text-gray-600 dark:text-gray-300">{{ t('search.startTitle') }}</p>
      <p class="text-sm mt-1">{{ t('search.startHint') }}</p>
    </div>
  </div>
</template>
