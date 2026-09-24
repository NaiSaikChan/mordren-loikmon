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
const AUTHORS_PER_PAGE = 20

const totalPages = computed(() => store.pagination?.total_pages ?? 1)
const isLastPage = computed(() => !store.pagination?.has_more)

async function fetchPage(targetPage: number) {
  page.value = Math.max(1, targetPage)
  try {
    await store.fetchAuthors({ page: page.value, limit: AUTHORS_PER_PAGE })
  } catch { /* empty state */ }
}

function goToPage(targetPage: number) {
  if (store.loading || targetPage < 1 || targetPage > totalPages.value) return
  void fetchPage(targetPage)
  window.dispatchEvent(new CustomEvent('loikmon:scroll-main-top'))
}

onMounted(() => void fetchPage(1))
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6 pt-1">{{ t('authors.title') }}</h1>
    <LoadingSpinner v-if="store.loading && !store.list.length" />
    <EmptyState v-else-if="!store.loading && !store.list.length" icon="✍️" :title="t('authors.noAuthors')" />
    <div v-else>
      <div class="authors-grid">
        <AuthorCard v-for="author in store.list" :key="author.id" :author="author" />
      </div>

      <Pagination
        v-if="totalPages > 1"
        :page="page"
        :is-last-page="isLastPage"
        :total-pages="totalPages"
        :loading="store.loading"
        @update:page="goToPage"
      />
    </div>
  </div>
</template>
