<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCategoriesStore } from '@/stores/categories'
import BookCard from '@/components/shared/BookCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const catStore = useCategoriesStore()

const books = ref<any[]>([])
const loading = ref(false)
const catName = ref('')
const page = ref(0)

async function loadBooks(reset = true) {
  loading.value = true
  if (reset) { page.value = 0; books.value = [] }
  const newBooks = await catStore.fetchBooksByCategory(props.id, undefined, page.value)
  books.value = reset ? newBooks : [...books.value, ...newBooks]
  loading.value = false
}

onMounted(async () => {
  await catStore.fetchCategories()
  const cat = catStore.list.find(c => String(c.id) === props.id)
  catName.value = cat?.name ?? 'Category'
  loadBooks()
})
</script>

<template>
  <div class="page-wrapper">
    <RouterLink to="/categories" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← Categories
    </RouterLink>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ catName }}</h1>
    <LoadingSpinner v-if="loading && !books.length" />
    <EmptyState v-else-if="!loading && !books.length" icon="📚" :title="t('common.notFound')" />
    <div v-else>
      <div class="content-grid">
        <BookCard v-for="book in books" :key="book.id" :book="book" />
      </div>
      <div class="mt-8 text-center">
        <button class="btn-secondary" :disabled="loading" @click="page++; loadBooks(false)">
          {{ loading ? t('common.loading') : t('common.more') }}
        </button>
      </div>
    </div>
  </div>
</template>
