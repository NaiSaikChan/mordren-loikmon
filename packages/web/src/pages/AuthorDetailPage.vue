<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthorsStore } from '@/stores/authors'
import { useBooksStore } from '@/stores/books'
import { useArticlesStore } from '@/stores/articles'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const authorsStore = useAuthorsStore()
const booksStore   = useBooksStore()
const articlesStore = useArticlesStore()

const author = computed(() => authorsStore.detail)
const tab = ref<'books' | 'articles'>('books')
const authorBooks    = ref<any[]>([])
const authorArticles = ref<any[]>([])

function fixUrl(url?: string) {
  if (!url) return ''
  return url.replace(/\\/g, '/').replace(/ /g, '%20')
}

onMounted(async () => {
  await authorsStore.fetchDetail(props.id)
  // Fetch books and articles by this author in parallel
  const [br, ar] = await Promise.all([
    booksStore.fetchBooks({ id: props.id, page: '0' }),
    articlesStore.fetchArticles({ id: props.id, page: '0' }),
  ])
  authorBooks.value    = booksStore.list
  authorArticles.value = articlesStore.list
})
</script>

<template>
  <div class="page-wrapper">
    <RouterLink to="/authors" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← {{ t('common.back') }}
    </RouterLink>

    <LoadingSpinner v-if="authorsStore.loading && !author" />

    <div v-else-if="author">
      <!-- Profile card -->
      <div class="card p-6 flex gap-5 items-start mb-6 flex-col sm:flex-row">
        <div class="w-24 h-24 rounded-full overflow-hidden bg-brand-100 dark:bg-brand-900/30 shrink-0 flex items-center justify-center">
          <img v-if="fixUrl(author.avatar_url ?? author.avatar)" :src="fixUrl(author.avatar_url ?? author.avatar)" :alt="author.name" class="w-full h-full object-cover" @error="($event.target as HTMLImageElement).style.display='none'" />
          <span v-else class="text-3xl font-bold text-brand-600">{{ author.name?.charAt(0) }}</span>
        </div>
        <div class="flex-1">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-1">{{ author.name }}</h1>
          <p class="text-sm text-gray-400 mb-3">
            {{ author.books_count ?? authorBooks.length }} books
            <span v-if="author.followers_count"> · {{ author.followers_count }} followers</span>
          </p>
          <p v-if="author.bio" class="text-sm text-gray-600 dark:text-gray-300 mb-4">{{ author.bio }}</p>
          <button
            :class="author.is_following ? 'btn-secondary' : 'btn-primary'"
            @click="authorsStore.toggleFollow(props.id)">
            {{ author.is_following ? t('authors.unfollow') : t('authors.follow') }}
          </button>
        </div>
      </div>

      <!-- Tab selector -->
      <div class="flex gap-2 mb-6">
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            tab === 'books' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'books'">
          📚 Books ({{ authorBooks.length }})
        </button>
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            tab === 'articles' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'articles'">
          📰 Articles ({{ authorArticles.length }})
        </button>
      </div>

      <!-- Books grid -->
      <div v-if="tab === 'books'">
        <div v-if="authorBooks.length" class="content-grid">
          <BookCard v-for="b in authorBooks" :key="b.id" :book="b" />
        </div>
        <p v-else class="text-center text-gray-400 py-8">No books found</p>
      </div>

      <!-- Articles list -->
      <div v-if="tab === 'articles'">
        <div v-if="authorArticles.length" class="space-y-3">
          <ArticleCard v-for="a in authorArticles" :key="a.id" :article="a" />
        </div>
        <p v-else class="text-center text-gray-400 py-8">No articles found</p>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">✍️</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
