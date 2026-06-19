<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBooksStore } from '@/stores/books'
import BookCard from '@/components/shared/BookCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const { t } = useI18n()
const store = useBooksStore()
const categoryFilter = ref<string>('')

onMounted(() => store.fetchBooks({}, true))

function loadMore() {
  store.fetchBooks(categoryFilter.value ? { category_id: categoryFilter.value } : {})
}
</script>

<template>
  <div class="page-wrapper">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('books.title') }}</h1>
    </div>

    <LoadingSpinner v-if="store.loading && store.list.length === 0" />
    <EmptyState v-else-if="!store.loading && store.list.length === 0" icon="📚" :title="t('common.notFound')" />

    <div v-else>
      <div class="content-grid">
        <BookCard v-for="book in store.list" :key="book.id" :book="book" />
      </div>

      <div v-if="store.hasMore" class="mt-8 text-center">
        <button class="btn-secondary" :disabled="store.loading" @click="loadMore">
          <span v-if="store.loading">{{ t('common.loading') }}</span>
          <span v-else>{{ t('common.more') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
