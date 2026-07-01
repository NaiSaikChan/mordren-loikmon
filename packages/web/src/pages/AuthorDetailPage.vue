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
const tab = ref<'about' | 'books' | 'articles'>('about')
const authorBooks    = ref<any[]>([])
const authorArticles = ref<any[]>([])

function fixUrl(url?: string) {
  if (!url) return ''
  return (url as string).replace(/\\/g, '/').replace(/ /g, '%20')
}

function getAuthorImage() {
  const url = author.value?.thumbnail ?? author.value?.avatar_url ?? author.value?.avatar ?? ''
  return fixUrl(url as string)
}

function getStats() {
  return [
    { label: '📚 Books', value: author.value?.books_count ?? author.value?.bookscount ?? authorBooks.value.length ?? 0 },
    { label: '📰 Articles', value: author.value?.articles_count ?? author.value?.articlescount ?? authorArticles.value.length ?? 0 },
    { label: '👥 Followers', value: Number(author.value?.followers_count ?? 0), show: Number(author.value?.followers_count ?? 0) > 0 },
  ]
}

onMounted(async () => {
  await authorsStore.fetchDetail(props.id)
  // Fetch books and articles by this author in parallel
  const [br, ar] = await Promise.all([
    booksStore.fetchBooks({
      email: 'null',
      id: props.id,
      type: 1,
      page: '0',
      cat: 0,
      sub: '0'
    }),
    articlesStore.fetchArticles({
      category: 0,
      email: 'null',
      itm: props.id,
      itmtype: 1,
      page: '0',
      sub: '0',
      type: 0
    }),
  ])
  authorBooks.value    = booksStore.list
  authorArticles.value = articlesStore.list
})
</script>

<template>
  <div class="page-wrapper max-w-4xl">
    <RouterLink to="/authors" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← {{ t('common.back') }}
    </RouterLink>

    <LoadingSpinner v-if="authorsStore.loading && !author" />

    <div v-else-if="author" class="space-y-6">
      <!-- Hero Section -->
      <div class="card overflow-hidden">
        <!-- Hero background -->
        <div class="h-40 bg-linear-to-r from-brand-500 to-brand-600 dark:from-brand-700 dark:to-brand-800"></div>
        
        <!-- Profile info -->
        <div class="px-6 pb-6">
          <div class="flex flex-col sm:flex-row gap-6 -mt-20 sm:-mt-20">
            <!-- Avatar -->
            <div class="shrink-0">
              <div v-if="getAuthorImage()" class="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-surface-900 shadow-lg bg-gray-200 dark:bg-surface-700">
                <img :src="getAuthorImage()" :alt="author.name" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-surface-900 shadow-lg bg-linear-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                <span class="text-5xl font-bold text-white">{{ author.name?.charAt(0) }}</span>
              </div>
            </div>

            <!-- Name and basic info -->
            <div class="flex-1 pt-4 sm:pt-12">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ author.name }}</h1>
              
              <!-- Stats -->
              <div class="flex flex-wrap gap-4 mb-4">
                <div v-for="stat in getStats()" :key="stat.label" v-show="stat.show !== false" class="flex items-center gap-2">
                  <span class="text-lg">{{ stat.label.split(' ')[0] }}</span>
                  <span class="font-semibold text-gray-700 dark:text-gray-300">{{ stat.value }}</span>
                </div>
              </div>

              <!-- Follow button -->
              <button
                :class="author.is_following ? 'btn-secondary' : 'btn-primary'"
                @click="authorsStore.toggleFollow(props.id)">
                {{ author.is_following ? t('authors.unfollow') : t('authors.follow') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          @click="tab = 'about'"
          :class="[
            'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px',
            tab === 'about'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          ]">
          ℹ️ About
        </button>
        <button
          @click="tab = 'books'"
          :class="[
            'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px',
            tab === 'books'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          ]">
          📚 Books ({{ authorBooks.length }})
        </button>
        <button
          @click="tab = 'articles'"
          :class="[
            'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px',
            tab === 'articles'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          ]">
          📰 Articles ({{ authorArticles.length }})
        </button>
      </div>

      <!-- About Tab -->
      <div v-show="tab === 'about'" class="space-y-6">
        <!-- Bio section -->
        <div v-if="author.bio" class="card p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Biography</h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{{ author.bio }}</p>
        </div>

        <!-- Additional info - Social Media -->
        <div class="card p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Follow</h2>
          <div class="flex flex-wrap gap-3">
            <a v-if="author.facebook" :href="author.facebook as string" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
              <span>f</span>
              <span>Facebook</span>
            </a>
            <a v-if="author.instagram" :href="author.instagram as string" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium transition-colors">
              <span>📷</span>
              <span>Instagram</span>
            </a>
            <a v-if="author.youtube" :href="author.youtube as string" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors">
              <span>▶</span>
              <span>YouTube</span>
            </a>
            <a v-if="author.email" :href="`mailto:${author.email}`" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-colors">
              <span>✉</span>
              <span>Email</span>
            </a>
          </div>
        </div>

        <!-- Additional details -->
        <div class="card p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Additional Information</h2>
          
          <!-- Description -->
          <div v-if="author.description" class="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase font-semibold">Description</p>
            <p class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{{ author.description }}</p>
          </div>
          
          <div class="space-y-3 text-sm">
            <div v-if="author.joined_date ?? author.created_at" class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Joined</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ new Date((author.joined_date ?? author.created_at ?? '') as string).toLocaleDateString() }}
              </span>
            </div>
            <div v-if="author.verified" class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Verified</span>
              <span class="font-medium text-green-600 dark:text-green-400">✓ Yes</span>
            </div>
            <div v-if="author.status" class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Status</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ author.status }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Books Tab -->
      <div v-show="tab === 'books'">
        <div v-if="authorBooks.length" class="content-grid">
          <BookCard v-for="b in authorBooks" :key="b.id" :book="b" />
        </div>
        <div v-else class="card p-12 text-center text-gray-400">
          <div class="text-5xl mb-3">📚</div>
          <p>No books found</p>
        </div>
      </div>

      <!-- Articles Tab -->
      <div v-show="tab === 'articles'">
        <div v-if="authorArticles.length" class="space-y-3">
          <ArticleCard v-for="a in authorArticles" :key="a.id" :article="a" />
        </div>
        <div v-else class="card p-12 text-center text-gray-400">
          <div class="text-5xl mb-3">📰</div>
          <p>No articles found</p>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">✍️</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
