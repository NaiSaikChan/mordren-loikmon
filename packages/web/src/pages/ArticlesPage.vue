<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useArticlesStore } from '@/stores/articles'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const { t } = useI18n()
const store = useArticlesStore()
onMounted(() => store.fetchArticles({}, true))
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('articles.title') }}</h1>
    <LoadingSpinner v-if="store.loading && store.list.length === 0" />
    <EmptyState v-else-if="!store.loading && store.list.length === 0" icon="📰" :title="t('common.notFound')" />
    <div v-else class="space-y-3">
      <ArticleCard v-for="article in store.list" :key="article.id" :article="article" />
    </div>
    <div v-if="store.hasMore" class="mt-6 text-center">
      <button class="btn-secondary" :disabled="store.loading" @click="store.fetchArticles()">
        {{ store.loading ? t('common.loading') : t('common.more') }}
      </button>
    </div>
  </div>
</template>
