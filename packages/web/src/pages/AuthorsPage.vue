<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthorsStore } from '@/stores/authors'
import AuthorCard from '@/components/shared/AuthorCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const store = useAuthorsStore()
onMounted(() => store.fetchAuthors())
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('authors.title') }}</h1>
    <LoadingSpinner v-if="store.loading" />
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <AuthorCard v-for="author in store.list" :key="author.id" :author="author" />
    </div>
  </div>
</template>
