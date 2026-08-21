<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthorsStore } from '@/stores/authors'
import AuthorCard from '@/components/shared/AuthorCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import Pagination from '@/components/shared/Pagination.vue'

const { t } = useI18n()
const store = useAuthorsStore()
const page = ref(1)
const AUTHORS_PER_ROW = 5
const AUTHORS_PER_PAGE = AUTHORS_PER_ROW * 4

const totalPages = computed(() => {
  const serverTotalPages = Number(store.totalPages ?? 0)
  if (serverTotalPages > 0) return serverTotalPages
  return Math.max(1, Math.ceil(Math.max(store.list.length, AUTHORS_PER_PAGE) / AUTHORS_PER_PAGE))
})

const isLastPage = computed(() => page.value >= totalPages.value)
const paginatedAuthors = computed(() => {
  const start = (page.value - 1) * AUTHORS_PER_PAGE
  return store.list.slice(start, start + AUTHORS_PER_PAGE)
})

async function fetchPage(targetPage: number) {
  const safePage = Math.max(1, targetPage)
  page.value = safePage
  await store.fetchAuthors({
    page: String(safePage - 1),
    limit: String(AUTHORS_PER_PAGE),
    replace: false,
  })
}

function goToPage(targetPage: number) {
  if (store.loading || targetPage < 1 || targetPage > totalPages.value) return
  void fetchPage(targetPage)
}

onMounted(() => void fetchPage(1))
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6 pt-1">{{ t('authors.title') }}</h1>
    <LoadingSpinner v-if="store.loading && !store.list.length" />
    <EmptyState v-else-if="!store.loading && !store.list.length" icon="✍️" :title="t('common.notFound')" />
    <div v-else>
      <div class="authors-grid">
        <AuthorCard v-for="author in paginatedAuthors" :key="author.id" :author="author" />
      </div>

      <Pagination
        :page="page"
        :is-last-page="isLastPage"
        :total-pages="totalPages"
        :loading="store.loading"
        @update:page="goToPage"
      />
    </div>
  </div>
</template>
