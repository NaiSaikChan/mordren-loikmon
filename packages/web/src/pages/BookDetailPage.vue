<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBooksStore } from '@/stores/books'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import BookCard from '@/components/shared/BookCard.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useBooksStore()

const book = computed(() => store.detail)

onMounted(async () => {
  await store.fetchDetail(props.id)
  await Promise.all([
    store.fetchChapters(props.id),
    store.fetchRelated(props.id),
  ])
})
</script>

<template>
  <div class="page-wrapper">
    <LoadingSpinner v-if="store.loading && !book" />

    <div v-else-if="book" class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex gap-6 mb-8">
        <div class="w-40 shrink-0 rounded-2xl overflow-hidden shadow-lg bg-gray-100 dark:bg-surface-800 aspect-[3/4]">
          <img v-if="book.cover_url ?? book.cover" :src="book.cover_url ?? book.cover" :alt="book.title" class="w-full h-full object-cover" />
        </div>
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ book.title }}</h1>
          <p class="text-brand-600 dark:text-brand-400 font-medium mb-3">
            {{ t('common.by') }} {{ book.author }}
          </p>
          <div class="flex flex-wrap gap-2 mb-4">
            <span v-if="book.is_free" class="badge-green">{{ t('books.free') }}</span>
            <span v-else-if="book.price" class="badge-brand">{{ book.price }} coins</span>
            <span v-if="book.rating" class="badge-yellow">⭐ {{ Number(book.rating).toFixed(1) }}</span>
            <span v-if="book.pages" class="badge-gray">{{ t('books.pages', { count: book.pages }) }}</span>
          </div>
          <div class="flex gap-3">
            <RouterLink :to="`/books/${id}/read`" class="btn-primary">
              📖 {{ t('books.read') }}
            </RouterLink>
            <button v-if="!book.is_free && !book.is_purchased" class="btn-secondary">
              💳 {{ t('books.purchase') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="book.description" class="mb-6">
        <h2 class="section-title">Description</h2>
        <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{{ book.description }}</p>
      </div>

      <!-- Chapters -->
      <div v-if="store.chapters.length" class="mb-6">
        <h2 class="section-title">{{ t('books.chapters') }}</h2>
        <div class="space-y-1">
          <div
            v-for="ch in store.chapters"
            :key="ch.id"
            class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-800 cursor-pointer transition-colors"
          >
            <span class="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300 shrink-0">
              {{ ch.order }}
            </span>
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ ch.title }}</span>
          </div>
        </div>
      </div>

      <!-- Related -->
      <div v-if="store.related.length">
        <h2 class="section-title">{{ t('books.related') }}</h2>
        <div class="content-grid">
          <BookCard v-for="b in store.related.slice(0, 6)" :key="b.id" :book="b" />
        </div>
      </div>
    </div>
  </div>
</template>
