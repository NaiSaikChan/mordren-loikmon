<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthorsStore } from '@/stores/authors'
import AuthorCard from '@/components/shared/AuthorCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const { t } = useI18n()
const store = useAuthorsStore()
const page = ref(0)
const isLastPage = ref(false)

async function loadMore() {
  page.value++
  const prevLen = store.list.length
  await store.fetchAuthors({ page: String(page.value) })
  if (store.list.length === prevLen) isLastPage.value = true
}

onMounted(() => store.fetchAuthors({ page: '0' }))
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('authors.title') }}</h1>
    <LoadingSpinner v-if="store.loading && !store.list.length" />
    <EmptyState v-else-if="!store.loading && !store.list.length" icon="✍️" :title="t('common.notFound')" />
    <div v-else>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <AuthorCard v-for="author in store.list" :key="author.id" :author="author" />
      </div>
      <div v-if="!isLastPage" class="mt-8 text-center">
        <button class="btn-secondary" :disabled="store.loading" @click="loadMore">
          {{ store.loading ? t('common.loading') : t('common.more') }}
        </button>
      </div>
    </div>
  </div>
</template>
