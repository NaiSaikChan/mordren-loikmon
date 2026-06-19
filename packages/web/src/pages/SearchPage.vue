<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSearchStore } from '@/stores/search'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import AuthorCard from '@/components/shared/AuthorCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useSearchStore()
const query = ref((route.query.q as string) ?? '')

watch(query, (q) => {
  router.replace({ query: q ? { q } : {} })
  store.search(q)
}, { debounce: 300 })

onMounted(() => {
  if (query.value) store.search(query.value)
})
</script>

<template>
  <div class="page-wrapper">
    <div class="max-w-2xl mx-auto mb-8">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input v-model="query" class="input pl-10 h-12 text-base" :placeholder="t('search.placeholder')" autofocus />
      </div>
    </div>

    <LoadingSpinner v-if="store.loading" />

    <div v-else-if="store.results">
      <!-- Books -->
      <section v-if="store.results.books?.length" class="mb-8">
        <h2 class="section-title">📚 Books</h2>
        <div class="content-grid">
          <BookCard v-for="b in store.results.books" :key="b.id" :book="b" />
        </div>
      </section>

      <!-- Articles -->
      <section v-if="store.results.articles?.length" class="mb-8">
        <h2 class="section-title">📰 Articles</h2>
        <div class="space-y-3">
          <ArticleCard v-for="a in store.results.articles" :key="a.id" :article="a" />
        </div>
      </section>

      <!-- Authors -->
      <section v-if="store.results.authors?.length" class="mb-8">
        <h2 class="section-title">✍️ Authors</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AuthorCard v-for="a in store.results.authors" :key="a.id" :author="a" />
        </div>
      </section>

      <div v-if="query && !store.loading && !store.results.books?.length && !store.results.articles?.length && !store.results.authors?.length"
        class="text-center py-16 text-gray-400">
        <div class="text-5xl mb-3">🔍</div>
        <p>{{ t('search.noResults', { query }) }}</p>
      </div>
    </div>

    <div v-else-if="!query" class="text-center py-16 text-gray-400">
      <div class="text-5xl mb-3">🔍</div>
      <p>{{ t('search.placeholder') }}</p>
    </div>
  </div>
</template>
