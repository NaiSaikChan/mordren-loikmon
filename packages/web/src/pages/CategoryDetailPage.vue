<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { articles as articlesApi, books as booksApi, categories as categoriesApi } from '@loikmon/api'
import type { Article, Book, Category } from '@loikmon/api'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import Pagination from '@/components/shared/Pagination.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import ResponsiveImg from '@/components/shared/ResponsiveImg.vue'
import { getCategoryIcon } from '@/composables/categoryIcons'

const props = defineProps<{ id: string }>()
const { t } = useI18n()

const PAGE_SIZE = 12

const category = ref<Category | null>(null)
const books = ref<Book[]>([])
const articles = ref<Article[]>([])
const booksTotal = ref(0)
const articlesTotal = ref(0)
const bookPage = ref(1)
const articlePage = ref(1)
const loading = ref(false)
const pageLoading = ref(false)
const failed = ref(false)

const bookTotalPages = computed(() => Math.max(1, Math.ceil(booksTotal.value / PAGE_SIZE)))
const articleTotalPages = computed(() => Math.max(1, Math.ceil(articlesTotal.value / PAGE_SIZE)))

/** Category with the first page of its books and articles (filtered by the server). */
async function loadCategory() {
  loading.value = true
  failed.value = false
  bookPage.value = 1
  articlePage.value = 1
  try {
    const { data } = await categoriesApi.getCategory(props.id, { page: 1, limit: PAGE_SIZE })
    category.value = data.category
    books.value = data.books ?? []
    articles.value = data.articles ?? []
    booksTotal.value = data.books_total ?? books.value.length
    articlesTotal.value = data.articles_total ?? articles.value.length
  } catch {
    category.value = null
    books.value = []
    articles.value = []
    booksTotal.value = 0
    articlesTotal.value = 0
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function changeBookPage(page: number) {
  bookPage.value = page
  pageLoading.value = true
  try {
    const { data } = await booksApi.fetchBooks({ category: Number(props.id), page, limit: PAGE_SIZE })
    books.value = data.books ?? []
    booksTotal.value = data.total ?? booksTotal.value
  } finally {
    pageLoading.value = false
  }
}

async function changeArticlePage(page: number) {
  articlePage.value = page
  pageLoading.value = true
  try {
    const { data } = await articlesApi.fetchArticles({ category: Number(props.id), page, limit: PAGE_SIZE })
    articles.value = data.articles ?? []
    articlesTotal.value = data.total ?? articlesTotal.value
  } finally {
    pageLoading.value = false
  }
}

watch(() => props.id, loadCategory, { immediate: true })
</script>

<template>
  <div class="page-wrapper">
    <RouterLink to="/categories" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← {{ t('categories.title') }}
    </RouterLink>

    <!-- Category header -->
    <div class="flex items-center gap-3 mb-8">
      <div class="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
        <ResponsiveImg :image="category?.thumbnail_image" :fallback="category?.thumbnail" :alt="category?.name ?? ''"
          fill eager sizes="48px">
          <template #empty><span>{{ getCategoryIcon(props.id) }}</span></template>
        </ResponsiveImg>
      </div>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ category?.name ?? t('categories.title') }}</h1>
        <p v-if="!loading && (booksTotal || articlesTotal)" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          <span v-if="booksTotal">{{ booksTotal }} {{ t('books.title') }}</span>
          <span v-if="booksTotal && articlesTotal"> · </span>
          <span v-if="articlesTotal">{{ articlesTotal }} {{ t('articles.title') }}</span>
        </p>
      </div>
    </div>

    <LoadingSpinner v-if="loading" />
    <EmptyState v-else-if="failed" icon="📚" :title="t('common.notFound')" />
    <EmptyState v-else-if="!books.length && !articles.length" icon="📚" :title="t('books.noBooks')" />

    <template v-else>
      <!-- Books section -->
      <section v-if="booksTotal">
        <div class="flex items-center gap-2 mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('books.title') }}</h2>
          <span class="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-medium">
            {{ booksTotal }}
          </span>
        </div>
        <div class="content-grid">
          <BookCard v-for="book in books" :key="book.id" :book="book" />
        </div>
        <Pagination
          v-if="bookTotalPages > 1"
          :page="bookPage"
          :is-last-page="bookPage >= bookTotalPages"
          :total-pages="bookTotalPages"
          :loading="pageLoading"
          @update:page="changeBookPage"
        />
      </section>

      <!-- Articles section -->
      <section
        v-if="articlesTotal"
        :class="{ 'mt-10 pt-10 border-t border-gray-100 dark:border-surface-800': booksTotal }"
      >
        <div class="flex items-center gap-2 mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('articles.title') }}</h2>
          <span class="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-medium">
            {{ articlesTotal }}
          </span>
        </div>
        <div class="flex flex-col gap-4">
          <ArticleCard v-for="article in articles" :key="article.id" :article="article" />
        </div>
        <Pagination
          v-if="articleTotalPages > 1"
          :page="articlePage"
          :is-last-page="articlePage >= articleTotalPages"
          :total-pages="articleTotalPages"
          :loading="pageLoading"
          @update:page="changeArticlePage"
        />
      </section>
    </template>
  </div>
</template>
