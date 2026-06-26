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

function fixUrl(url: string): string {
  if (!url) return ''
  let u = url.replace(/\\/g, '/')
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
  return u
}

const cover   = computed(() => fixUrl(book.value?.thumbnail ?? book.value?.coverphoto ?? book.value?.cover_url ?? book.value?.cover ?? ''))
const pdfUrl  = computed(() => fixUrl(book.value?.pdf ?? ''))
const authorName = computed(() => book.value?.authorname ?? book.value?.author ?? '')
const isFree  = computed(() => {
  const p = book.value?.amount ?? book.value?.price
  return book.value?.is_free || !p || Number(p) === 0
})

onMounted(async () => {
  await store.fetchDetail(props.id)
  store.fetchRelated(props.id)
})
</script>

<template>
  <div class="page-wrapper">
    <RouterLink to="/books" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← {{ t('common.back') }}
    </RouterLink>

    <LoadingSpinner v-if="store.loading && !book" />

    <div v-else-if="book" class="max-w-4xl mx-auto">
      <div class="flex gap-6 mb-8 flex-col sm:flex-row">
        <div class="w-40 shrink-0 rounded-2xl overflow-hidden shadow-lg bg-gray-100 dark:bg-surface-800 aspect-[3/4]">
          <img v-if="cover" :src="cover" :alt="book.title" class="w-full h-full object-cover"
            @error="($event.target as HTMLImageElement).style.display='none'" />
          <div v-else class="w-full h-full flex items-center justify-center text-5xl">📚</div>
        </div>
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ book.title }}</h1>
          <p v-if="authorName" class="text-brand-600 dark:text-brand-400 font-medium mb-3">
            {{ t('common.by') }} {{ authorName }}
          </p>
          <div class="flex flex-wrap gap-2 mb-4">
            <span v-if="isFree" class="badge-green">{{ t('books.free') }}</span>
            <span v-else class="badge-brand">{{ book.amount ?? book.price }} coins</span>
            <span v-if="book.rating" class="badge-yellow">⭐ {{ Number(book.rating).toFixed(1) }}</span>
            <span v-if="book.pages" class="badge-gray">{{ book.pages }} pages</span>
            <span v-if="book.categoryname" class="badge-gray">{{ book.categoryname }}</span>
          </div>
          <div class="flex flex-wrap gap-3">
            <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener" class="btn-primary">
              📖 {{ t('books.read') }}
            </a>
            <RouterLink v-else :to="`/books/${id}/read`" class="btn-primary">
              📖 {{ t('books.read') }}
            </RouterLink>
            <button v-if="!isFree && !book.is_purchased" class="btn-secondary">
              💳 {{ t('books.purchase') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="book.description" class="mb-6">
        <h2 class="section-title">Description</h2>
        <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{{ book.description }}</p>
      </div>

      <div v-if="store.related.length">
        <h2 class="section-title">{{ t('books.related') }}</h2>
        <div class="content-grid">
          <BookCard v-for="b in store.related.slice(0, 6)" :key="b.id" :book="b" />
        </div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">📚</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
