<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCategoriesStore } from '@/stores/categories'
import { useArticlesStore } from '@/stores/articles'
import type { Book, Article } from '@loikmon/api'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import Pagination from '@/components/shared/Pagination.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import { getCategoryIcon } from '@/composables/categoryIcons'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const catStore = useCategoriesStore()
const articleStore = useArticlesStore()

const BOOK_PAGE_SIZE = 12
const ARTICLE_PAGE_SIZE = 10

// Accumulated filtered data loaded upfront; paginated client-side via computed slices
const allBooks = ref<Book[]>([])
const allArticles = ref<Article[]>([])
const bookPage = ref(1)
const articlePage = ref(1)
const loading = ref(false)
const catName = ref('')

// Server returns mixed categories regardless of the category param — always filter client-side
function matchesCat(item: { category?: unknown }): boolean {
  return String(item.category ?? '') === String(props.id)
}

const paginatedBooks = computed(() => {
  const start = (bookPage.value - 1) * BOOK_PAGE_SIZE
  return allBooks.value.slice(start, start + BOOK_PAGE_SIZE)
})

const bookTotalPages = computed(() =>
  allBooks.value.length > 0 ? Math.ceil(allBooks.value.length / BOOK_PAGE_SIZE) : 0
)

const isLastBookPage = computed(() =>
  allBooks.value.length === 0 || bookPage.value >= bookTotalPages.value
)

const paginatedArticles = computed(() => {
  const start = (articlePage.value - 1) * ARTICLE_PAGE_SIZE
  return allArticles.value.slice(start, start + ARTICLE_PAGE_SIZE)
})

const articleTotalPages = computed(() =>
  allArticles.value.length > 0 ? Math.ceil(allArticles.value.length / ARTICLE_PAGE_SIZE) : 0
)

const isLastArticlePage = computed(() =>
  allArticles.value.length === 0 || articlePage.value >= articleTotalPages.value
)

async function loadAll() {
  loading.value = true
  allBooks.value = []
  allArticles.value = []
  bookPage.value = 1
  articlePage.value = 1

  const seenBookIds = new Set<string>()
  const seenArticleIds = new Set<string>()
  let moreBooks = true
  let moreArticles = true

  try {
    // Fetch 3 pages of books + articles in parallel per iteration; filter matches client-side
    for (let p = 0; p < 3; p++) {
      await Promise.all([
        moreBooks
          ? (catStore.fetchBooksByCategory(props.id, undefined, p) as Promise<Book[]>).then(items => {
              moreBooks = items.length > 0
              const fresh = items.filter(b => matchesCat(b) && !seenBookIds.has(String(b.id)))
              fresh.forEach(b => seenBookIds.add(String(b.id)))
              allBooks.value = [...allBooks.value, ...fresh]
            })
          : Promise.resolve(),
        moreArticles
          ? articleStore.fetchArticles({ page: p, limit: 50, type: 1, query: '', category: Number(props.id) }).then(count => {
              moreArticles = count > 0
              const fresh = articleStore.list.filter(a => matchesCat(a) && !seenArticleIds.has(String(a.id)))
              fresh.forEach(a => seenArticleIds.add(String(a.id)))
              allArticles.value = [...allArticles.value, ...fresh]
            })
          : Promise.resolve(),
      ])
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => props.id,
  async (id) => {
    if (!catStore.list.length) await catStore.fetchCategories()
    const cat = catStore.list.find(c => String(c.id) === id)
    catName.value = cat?.name ?? 'Category'
    await loadAll()
  },
  { immediate: true },
)
</script>

<template>
  <div class="page-wrapper">
    <RouterLink to="/categories" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← Categories
    </RouterLink>

    <!-- Category header -->
    <div class="flex items-center gap-3 mb-8">
      <div class="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-2xl shrink-0">
        {{ getCategoryIcon(props.id) }}
      </div>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ catName }}</h1>
        <p v-if="!loading && (allBooks.length || allArticles.length)" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          <span v-if="allBooks.length">{{ allBooks.length }} {{ t('books.title') }}</span>
          <span v-if="allBooks.length && allArticles.length"> · </span>
          <span v-if="allArticles.length">{{ allArticles.length }} {{ t('articles.title') }}</span>
        </p>
      </div>
    </div>

    <LoadingSpinner v-if="loading && !allBooks.length && !allArticles.length" />
    <EmptyState v-else-if="!loading && !allBooks.length && !allArticles.length" icon="📚" :title="t('common.notFound')" />

    <template v-else>
      <!-- Books section -->
      <section v-if="allBooks.length">
        <div class="flex items-center gap-2 mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('books.title') }}</h2>
          <span class="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-medium">
            {{ allBooks.length }}
          </span>
        </div>
        <div class="content-grid">
          <BookCard v-for="book in paginatedBooks" :key="book.id" :book="book" />
        </div>
        <Pagination
          v-if="bookTotalPages > 1"
          :page="bookPage"
          :is-last-page="isLastBookPage"
          :total-pages="bookTotalPages"
          :loading="loading"
          @update:page="bookPage = $event"
        />
      </section>

      <!-- Articles section -->
      <section
        v-if="allArticles.length"
        :class="{ 'mt-10 pt-10 border-t border-gray-100 dark:border-surface-800': allBooks.length }"
      >
        <div class="flex items-center gap-2 mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('articles.title') }}</h2>
          <span class="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-medium">
            {{ allArticles.length }}
          </span>
        </div>
        <div class="flex flex-col gap-4">
          <ArticleCard v-for="article in paginatedArticles" :key="article.id" :article="article" />
        </div>
        <Pagination
          v-if="articleTotalPages > 1"
          :page="articlePage"
          :is-last-page="isLastArticlePage"
          :total-pages="articleTotalPages"
          :loading="loading"
          @update:page="articlePage = $event"
        />
      </section>
    </template>
  </div>
</template>
