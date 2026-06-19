<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'
import BookCard from '@/components/shared/BookCard.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const booksStore = useBooksStore()
const authStore = useAuthStore()

onMounted(() => {
  booksStore.fetchBooks()
})
</script>

<template>
  <div class="page-wrapper">
    <!-- Welcome banner -->
    <div class="mb-8 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 p-6 text-white shadow-lg">
      <p class="text-brand-200 text-sm font-medium mb-1">Welcome back 👋</p>
      <h1 class="text-2xl font-bold">{{ authStore.displayName || 'Reader' }}</h1>
      <p class="mt-2 text-brand-100 text-sm">Explore thousands of Mon books and articles</p>
      <div class="mt-4 flex gap-3">
        <RouterLink to="/books" class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
          📚 Browse Books
        </RouterLink>
        <RouterLink to="/music" class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
          🎵 Listen
        </RouterLink>
      </div>
    </div>

    <!-- Quick links -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <RouterLink v-for="item in [
        { to: '/books', icon: '📚', label: t('nav.books'), color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' },
        { to: '/articles', icon: '📰', label: t('nav.articles'), color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
        { to: '/music', icon: '🎵', label: t('nav.music'), color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' },
        { to: '/library', icon: '🗂️', label: t('nav.library'), color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
      ]" :key="item.to" :to="item.to"
        :class="['card flex flex-col items-center justify-center p-4 gap-2 no-underline', item.color]">
        <span class="text-2xl">{{ item.icon }}</span>
        <span class="text-xs font-semibold">{{ item.label }}</span>
      </RouterLink>
    </div>

    <!-- Recent books -->
    <SectionHeader :title="t('books.title')" :to="'/books'" />
    <LoadingSpinner v-if="booksStore.loading" />
    <div v-else class="content-grid">
      <BookCard v-for="book in booksStore.list.slice(0, 12)" :key="book.id" :book="book" />
    </div>
  </div>
</template>
