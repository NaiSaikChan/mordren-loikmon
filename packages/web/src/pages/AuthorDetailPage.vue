<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthorsStore } from '@/stores/authors'
import { useAuthStore } from '@/stores/auth'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authorsStore = useAuthorsStore()
const auth = useAuthStore()

const author = computed(() =>
  authorsStore.detail && String(authorsStore.detail.id) === String(props.id) ? authorsStore.detail : null,
)
const tab = ref<'about' | 'books' | 'articles'>('about')
const following = ref(false)

const stats = computed(() => [
  { key: 'books', icon: '📚', value: author.value?.books_count ?? authorsStore.books.length, show: true },
  { key: 'articles', icon: '📰', value: author.value?.articles_count ?? authorsStore.articles.length, show: true },
  { key: 'followers', icon: '👥', value: Number(author.value?.followers_count ?? 0), show: Number(author.value?.followers_count ?? 0) > 0 },
])

async function toggleFollow() {
  if (!auth.isLoggedIn) {
    void router.push({ name: 'auth', query: { redirect: route.fullPath } })
    return
  }
  following.value = true
  try {
    await authorsStore.toggleFollow(props.id)
  } finally {
    following.value = false
  }
}

// Books and articles come with the author profile (server-side filtered by author).
watch(() => props.id, (id) => {
  tab.value = 'about'
  void authorsStore.fetchDetail(id)
}, { immediate: true })

// `is_following` depends on the session.
watch(() => auth.token, () => { void authorsStore.fetchDetail(props.id) })
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
        <div class="h-40 bg-linear-to-r from-brand-500 to-brand-600 dark:from-brand-700 dark:to-brand-800"></div>

        <div class="px-6 pb-6">
          <div class="flex flex-col sm:flex-row gap-6 -mt-20 sm:-mt-20">
            <!-- Avatar -->
            <div class="shrink-0">
              <div v-if="author.thumbnail" class="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-surface-900 shadow-lg bg-gray-200 dark:bg-surface-700">
                <img :src="author.thumbnail" :alt="author.name" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-surface-900 shadow-lg bg-linear-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                <span class="text-5xl font-bold text-white">{{ author.name?.charAt(0) }}</span>
              </div>
            </div>

            <!-- Name and basic info -->
            <div class="flex-1 pt-4 sm:pt-12">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {{ author.name }}
                <span v-if="author.verified" class="text-base text-brand-500" title="Verified">✓</span>
              </h1>

              <div class="flex flex-wrap gap-4 mb-4">
                <div v-for="stat in stats" v-show="stat.show" :key="stat.key" class="flex items-center gap-2">
                  <span class="text-lg">{{ stat.icon }}</span>
                  <span class="font-semibold text-gray-700 dark:text-gray-300">{{ stat.value }}</span>
                </div>
              </div>

              <button
                type="button"
                :class="author.is_following ? 'btn-secondary' : 'btn-primary'"
                :disabled="following"
                :aria-pressed="author.is_following"
                data-testid="follow-toggle"
                @click="toggleFollow">
                {{ author.is_following ? t('authors.unfollow') : t('authors.follow') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          v-for="item in ([
            { key: 'about', label: `ℹ️ ${t('authors.about')}` },
            { key: 'books', label: `📚 ${t('authors.booksTab', { count: authorsStore.books.length })}` },
            { key: 'articles', label: `📰 ${t('authors.articlesTab', { count: authorsStore.articles.length })}` },
          ] as const)"
          :key="item.key"
          type="button"
          :class="[
            'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px',
            tab === item.key
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          ]"
          @click="tab = item.key">
          {{ item.label }}
        </button>
      </div>

      <!-- About Tab -->
      <div v-show="tab === 'about'" class="space-y-6">
        <div v-if="author.bio" class="card p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">{{ t('authors.biography') }}</h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{{ author.bio }}</p>
        </div>

        <div v-if="author.facebook || author.instagram || author.youtube || author.website" class="card p-6">
          <div class="flex flex-wrap gap-3">
            <a v-if="author.facebook" :href="author.facebook" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
              <span>f</span>
              <span>Facebook</span>
            </a>
            <a v-if="author.instagram" :href="author.instagram" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium transition-colors">
              <span>📷</span>
              <span>Instagram</span>
            </a>
            <a v-if="author.youtube" :href="author.youtube" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors">
              <span>▶</span>
              <span>YouTube</span>
            </a>
            <a v-if="author.website" :href="author.website" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-colors">
              <span>🌐</span>
              <span>Website</span>
            </a>
          </div>
        </div>

        <div v-if="author.joined_date" class="card p-6 text-sm flex justify-between">
          <span class="text-gray-600 dark:text-gray-400">Joined</span>
          <span class="font-medium text-gray-900 dark:text-white">{{ new Date(author.joined_date).toLocaleDateString() }}</span>
        </div>
      </div>

      <!-- Books Tab -->
      <div v-show="tab === 'books'">
        <div v-if="authorsStore.books.length" class="content-grid">
          <BookCard v-for="b in authorsStore.books" :key="b.id" :book="b" />
        </div>
        <div v-else class="card p-12 text-center text-gray-400">
          <div class="text-5xl mb-3">📚</div>
          <p>{{ t('authors.noBooks') }}</p>
        </div>
      </div>

      <!-- Articles Tab -->
      <div v-show="tab === 'articles'">
        <div v-if="authorsStore.articles.length" class="space-y-3">
          <ArticleCard v-for="a in authorsStore.articles" :key="a.id" :article="a" />
        </div>
        <div v-else class="card p-12 text-center text-gray-400">
          <div class="text-5xl mb-3">📰</div>
          <p>{{ t('authors.noArticles') }}</p>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">✍️</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
