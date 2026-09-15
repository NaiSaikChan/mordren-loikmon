<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore } from '@/stores/collections'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useCollectionsStore()
const col = computed(() => (store.detail && String(store.detail.id) === String(props.id) ? store.detail : null))

watch(() => props.id, (id) => { void store.fetchDetail(id) }, { immediate: true })
</script>

<template>
  <div class="page-wrapper">
    <RouterLink to="/collections" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← {{ t('nav.collections') }}
    </RouterLink>

    <LoadingSpinner v-if="store.loading && !col" />

    <div v-else-if="col">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ col.title || col.name }}</h1>
      <p v-if="col.description" class="text-gray-500 dark:text-gray-400 mb-6">{{ col.description }}</p>

      <section v-if="col.books?.length" class="mb-8">
        <h2 class="section-title">📚 {{ t('books.title') }}</h2>
        <div class="content-grid">
          <BookCard v-for="b in col.books" :key="b.id" :book="b" />
        </div>
      </section>

      <section v-if="col.articles?.length">
        <h2 class="section-title">📰 {{ t('articles.title') }}</h2>
        <div class="space-y-3">
          <ArticleCard v-for="a in col.articles" :key="a.id" :article="a" />
        </div>
      </section>

      <div v-if="!col.books?.length && !col.articles?.length" class="card p-12 text-center text-gray-400">
        <div class="text-5xl mb-3">📦</div>
        <p>{{ t('collections.emptyCollection') }}</p>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">📦</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
