<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { ItemType } from '@loikmon/api'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

/** Saved books and articles, stored on the server (synced with the mobile apps). */
const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const store = useLibraryStore()

const tab = ref<'books' | 'articles'>('books')
const failed = ref(false)
const removing = ref<string | null>(null)

async function load() {
  if (!authStore.isLoggedIn) return
  failed.value = false
  try {
    await store.fetch()
  } catch {
    failed.value = true
  }
}

async function remove(type: ItemType, id: number) {
  removing.value = `${type}:${id}`
  try {
    await store.remove(type, id)
  } finally {
    removing.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('library.title') }}</h1>

    <!-- Not logged in -->
    <div v-if="!authStore.isLoggedIn" class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">🔐</div>
      <p class="mb-4">{{ t('library.loginPrompt') }}</p>
      <RouterLink :to="{ name: 'auth', query: { redirect: route.fullPath } }" class="btn-primary inline-flex">{{ t('auth.login') }}</RouterLink>
    </div>

    <div v-else>
      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button type="button" :class="['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            tab === 'books' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'books'">📚 {{ t('library.booksTab', { count: store.books.length }) }}</button>
        <button type="button" :class="['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            tab === 'articles' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'articles'">📰 {{ t('library.articlesTab', { count: store.articles.length }) }}</button>
      </div>

      <LoadingSpinner v-if="store.loading && !store.loaded" />

      <div v-else-if="failed" class="card p-10 text-center text-gray-500 dark:text-gray-400">
        <p class="mb-4">{{ t('common.error') }}</p>
        <button type="button" class="btn-primary" @click="load">{{ t('common.retry') }}</button>
      </div>

      <div v-else-if="tab === 'books'">
        <div v-if="store.books.length" class="content-grid">
          <div v-for="b in store.books" :key="b.id" class="flex flex-col gap-2">
            <BookCard :book="b" />
            <button
              type="button"
              class="btn-ghost text-xs text-red-500"
              :disabled="removing === `book:${b.id}`"
              @click="remove('book', b.id)"
            >{{ t('library.removeFromLibrary') }}</button>
          </div>
        </div>
        <div v-else class="card p-12 text-center text-gray-400">
          <div class="text-5xl mb-3">📚</div>
          <p>{{ t('library.emptyBooks') }}</p>
          <RouterLink to="/books" class="btn-primary inline-flex mt-4">{{ t('library.browseBooks') }}</RouterLink>
        </div>
      </div>

      <div v-else-if="tab === 'articles'">
        <div v-if="store.articles.length" class="space-y-3">
          <div v-for="a in store.articles" :key="a.id">
            <ArticleCard :article="a" />
            <div class="mt-1 text-right">
              <button
                type="button"
                class="btn-ghost text-xs text-red-500"
                :disabled="removing === `article:${a.id}`"
                @click="remove('article', a.id)"
              >{{ t('library.removeFromLibrary') }}</button>
            </div>
          </div>
        </div>
        <div v-else class="card p-12 text-center text-gray-400">
          <div class="text-5xl mb-3">📰</div>
          <p>{{ t('library.emptyArticles') }}</p>
          <RouterLink to="/articles" class="btn-primary inline-flex mt-4">{{ t('library.browseArticles') }}</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
