<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBooksStore } from '@/stores/books'
import { useArticlesStore } from '@/stores/articles'
import { useAuthStore } from '@/stores/auth'
import { misc } from '@loikmon/api'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const booksStore   = useBooksStore()
const articlesStore = useArticlesStore()
const authStore    = useAuthStore()

const sliders   = ref<any[]>([])
const leagues   = ref<any[]>([])
const initDone  = ref(false)

onMounted(async () => {
  try {
    const res = await misc.initApp(authStore.user?.email as string)
    const body = res.data as any
    sliders.value = body.sliders ?? []
    leagues.value = body.leagues ?? []

    if (body.books?.length)    booksStore.list    = body.books
    if (body.articles?.length) articlesStore.list = body.articles
  } catch { /* fallback to individual fetches */ }

  if (!booksStore.list.length)    booksStore.fetchBooks()
  if (!articlesStore.list.length) articlesStore.fetchArticles()
  initDone.value = true
})
</script>

<template>
  <div class="page-wrapper">
    <!-- Welcome Banner -->
    <div class="mb-8 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 p-6 text-white shadow-lg">
      <p class="text-brand-200 text-sm font-medium mb-1">Welcome back 👋</p>
      <h1 class="text-2xl font-bold">{{ authStore.displayName || 'Reader' }}</h1>
      <p class="mt-1 text-brand-100 text-sm">Explore thousands of Mon books and articles</p>
      <div class="mt-4 flex gap-3 flex-wrap">
        <RouterLink to="/books" class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
          📚 Browse Books
        </RouterLink>
        <RouterLink to="/music" class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
          🎵 Listen
        </RouterLink>
      </div>
    </div>

    <!-- Quick nav cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <RouterLink v-for="item in [
        { to: '/books',    icon: '📚', label: t('nav.books'),    color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' },
        { to: '/articles', icon: '📰', label: t('nav.articles'), color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
        { to: '/music',    icon: '🎵', label: t('nav.music'),    color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' },
        { to: '/library',  icon: '🗂️', label: t('nav.library'),  color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
      ]" :key="item.to" :to="item.to"
        :class="['card flex flex-col items-center justify-center p-4 gap-2 no-underline', item.color]">
        <span class="text-2xl">{{ item.icon }}</span>
        <span class="text-xs font-semibold">{{ item.label }}</span>
      </RouterLink>
    </div>

    <!-- Leagues / Music Categories -->
    <div v-if="leagues.length" class="mb-8">
      <SectionHeader title="🎵 Audio Books" :to="'/music'" />
      <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        <RouterLink v-for="l in leagues" :key="l.id"
          :to="`/music?league=${l.id}`"
          class="shrink-0 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
          {{ l.name ?? l.title }}
        </RouterLink>
      </div>
    </div>

    <!-- Books -->
    <SectionHeader :title="t('books.title')" :to="'/books'" />
    <LoadingSpinner v-if="booksStore.loading && !booksStore.list.length" />
    <div v-else class="content-grid mb-8">
      <BookCard v-for="book in booksStore.list.slice(0, 12)" :key="book.id" :book="book" />
    </div>

    <!-- Articles -->
    <SectionHeader :title="t('articles.title')" :to="'/articles'" />
    <LoadingSpinner v-if="articlesStore.loading && !articlesStore.list.length" />
    <div v-else class="space-y-3">
      <ArticleCard v-for="article in articlesStore.list.slice(0, 5)" :key="article.id" :article="article" />
    </div>
  </div>
</template>
