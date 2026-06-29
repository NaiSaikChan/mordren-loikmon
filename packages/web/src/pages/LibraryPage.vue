<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { usePurchasesStore } from '@/stores/purchases'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const store = usePurchasesStore()

const tab = ref<'books' | 'articles'>('books')

onMounted(() => {
  if (authStore.isLoggedIn) store.fetchAll()
})
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('library.title') }}</h1>

    <!-- Not logged in -->
    <div v-if="!authStore.isLoggedIn" class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">🔐</div>
      <p class="mb-4">Login to access your library</p>
      <RouterLink to="/auth" class="btn-primary inline-flex">Login</RouterLink>
    </div>

    <div v-else>
      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            tab === 'books' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'books'">📚 Books ({{ store.books.length }})</button>
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            tab === 'articles' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'articles'">📰 Articles ({{ store.articles.length }})</button>
      </div>

      <LoadingSpinner v-if="store.loading" />

      <div v-else-if="tab === 'books'">
        <div v-if="store.books.length" class="content-grid">
          <BookCard v-for="b in store.books" :key="b.id" :book="b" />
        </div>
        <div v-else class="card p-12 text-center text-gray-400">
          <div class="text-5xl mb-3">📚</div>
          <p>No purchased books yet</p>
          <RouterLink to="/books" class="btn-primary inline-flex mt-4">Browse Books</RouterLink>
        </div>
      </div>

      <div v-else-if="tab === 'articles'">
        <div v-if="store.articles.length" class="space-y-3">
          <ArticleCard v-for="a in store.articles" :key="a.id" :article="a" />
        </div>
        <div v-else class="card p-12 text-center text-gray-400">
          <div class="text-5xl mb-3">📰</div>
          <p>No purchased articles yet</p>
          <RouterLink to="/articles" class="btn-primary inline-flex mt-4">Browse Articles</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
