<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore } from '@/stores/collections'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useCollectionsStore()
const col = computed(() => store.detail)

onMounted(() => store.fetchDetail(props.id))
</script>

<template>
  <div class="page-wrapper">
    <RouterLink to="/collections" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← Collections
    </RouterLink>

    <LoadingSpinner v-if="store.loading && !col" />

    <div v-else-if="col">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ col.name ?? col.title }}</h1>
      <p v-if="col.description" class="text-gray-500 dark:text-gray-400 mb-6">{{ col.description }}</p>

      <!-- Books in collection -->
      <section v-if="col.books?.length" class="mb-8">
        <h2 class="section-title">📚 Books</h2>
        <div class="content-grid">
          <BookCard v-for="b in col.books" :key="b.id" :book="b" />
        </div>
      </section>

      <!-- Articles in collection -->
      <section v-if="col.articles?.length">
        <h2 class="section-title">📰 Articles</h2>
        <div class="space-y-3">
          <ArticleCard v-for="a in col.articles" :key="a.id" :article="a" />
        </div>
      </section>

      <div v-if="!col.books?.length && !col.articles?.length" class="card p-12 text-center text-gray-400">
        <div class="text-5xl mb-3">📦</div>
        <p>This collection is empty</p>
      </div>
    </div>
  </div>
</template>
