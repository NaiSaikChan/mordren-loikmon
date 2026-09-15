<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { useI18n } from 'vue-i18n'
import { articles as articlesApi } from '@loikmon/api'
import { useArticlesStore } from '@/stores/articles'
import { useReviewsStore } from '@/stores/reviews'
import { useAuthStore } from '@/stores/auth'
import { useArticleAudio } from '@/composables/useArticleAudio'
import { useContentProtection } from '@/composables/useContentProtection'
import { lockReasonFromAccess } from '@/utils/access'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import ArticleAudioCard from '@/components/media/ArticleAudioCard.vue'
import AccessBadge from '@/components/shared/AccessBadge.vue'
import Paywall from '@/components/shared/Paywall.vue'
import SaveButton from '@/components/shared/SaveButton.vue'
import ReviewsSection from '@/components/shared/ReviewsSection.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useArticlesStore()
const reviews = useReviewsStore()
const auth = useAuthStore()

const article = computed(() => (store.detail && String(store.detail.id) === String(props.id) ? store.detail : null))
const thumbnail = computed(() => article.value?.thumbnail_url ?? article.value?.thumbnail ?? '')
const tab = ref<'content' | 'reviews'>('content')
const protectedContent = ref<HTMLElement | null>(null)
const { toastVisible, toastMessage, devToolsDetected, watermarkText } = useContentProtection(protectedContent)

/** The server only sends `content` / `audio_url` to viewers with access. */
const lockReason = computed(() =>
  article.value?.locked ? (lockReasonFromAccess(article.value.access) ?? 'subscription_required') : null,
)
const { track: audioTrack, play: playAudio } = useArticleAudio(article)

const publishedAt = computed(() => {
  const raw = article.value?.published_at ?? article.value?.articledate ?? article.value?.created_at
  if (!raw) return ''
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
})

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b','strong','i','em','u','s','h1','h2','h3','h4','h5','h6',
      'p','br','hr','ul','ol','li','blockquote','pre','code',
      'a','img','span','div','table','thead','tbody','tr','th','td'],
    ALLOWED_ATTR: ['href','src','alt','title','class','target','rel','width','height'],
    ALLOW_DATA_ATTR: false,
  })
}

async function loadArticle() {
  tab.value = 'content'
  const current = await store.fetchDetail(props.id)
  if (!current) return
  void reviews.loadReviews('article', props.id)
  void articlesApi.updateArticleTotalViews(props.id).catch(() => undefined)
}

/** Reload the body when the session changes (signed in / subscribed). */
function reloadAccess() {
  void store.fetchDetail(props.id)
}

onMounted(loadArticle)
watch(() => props.id, loadArticle)
watch(() => [auth.token, Boolean(auth.entitlement?.active)] as const, (next, prev) => {
  if (next[0] !== prev[0] || (next[1] !== prev[1] && lockReason.value)) reloadAccess()
})
</script>

<template>
  <div class="page-wrapper max-w-3xl">
    <RouterLink to="/articles" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← {{ t('articles.title') }}
    </RouterLink>

    <LoadingSpinner v-if="store.loading && !article" />

    <div v-else-if="article">
      <!-- Thumbnail banner -->
      <div v-if="thumbnail"
        class="w-full h-52 rounded-2xl overflow-hidden mb-6 bg-gray-100 dark:bg-surface-800">
        <img :src="thumbnail" :alt="article.title"
          class="w-full h-full object-cover"
          loading="eager"
          fetchpriority="high"
          decoding="async"
          @error="($event.target as HTMLImageElement).style.display='none'" />
      </div>

      <!-- Meta -->
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">{{ article.title }}</h1>
      <div class="flex items-center gap-3 text-sm text-gray-400 mb-4 flex-wrap">
        <RouterLink v-if="article.author_id && article.authorname" :to="`/authors/${article.author_id}`" class="hover:underline">✍️ {{ article.authorname }}</RouterLink>
        <span v-else-if="article.authorname">✍️ {{ article.authorname }}</span>
        <span v-if="article.categoryname">📂 {{ article.categoryname }}</span>
        <span v-if="publishedAt">📅 {{ publishedAt }}</span>
        <span v-if="article.views">👁 {{ article.views }}</span>
        <AccessBadge :item="article" size="sm" />
      </div>
      <div class="mb-6">
        <SaveButton item-type="article" :item-id="article.id" :in-library="article.in_library" @change="store.setInLibrary" />
      </div>

      <!-- Audio (signed URL, only present with access) -->
      <ArticleAudioCard
        v-if="audioTrack"
        :title="audioTrack.title"
        :artist="audioTrack.artist"
        :cover="audioTrack.cover"
        :action-label="t('music.listen')"
        @play="playAudio"
      />

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'content' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'content'">{{ t('articles.content') }}</button>
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'reviews' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'reviews'">{{ t('reviews.tab', { count: reviews.summary.count || reviews.list.length }) }}</button>
      </div>

      <!-- Content -->
      <div v-if="tab === 'content'">
        <!-- Locked: excerpt + paywall -->
        <div v-if="lockReason" class="card p-6 space-y-5" data-testid="article-locked">
          <div v-if="article.excerpt" class="relative">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{{ t('articles.preview') }}</p>
            <p class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line" data-testid="article-excerpt">{{ article.excerpt }}</p>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-white dark:from-surface-900" />
          </div>
          <Paywall :reason="lockReason" @unlocked="reloadAccess">
            <p v-if="article.has_audio" class="mt-3 text-xs text-gray-500 dark:text-gray-400">🎧 {{ t('paywall.audioTitle') }}</p>
          </Paywall>
        </div>

        <!-- Content available -->
        <div v-else class="card relative p-6">
          <div
            ref="protectedContent"
            class="protected-content prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
            data-testid="article-content"
            v-html="sanitizeHtml(article.content || article.excerpt || t('articles.noContent'))">
          </div>
          <div class="protected-watermark" aria-hidden="true">{{ watermarkText }}</div>
          <div class="protected-print-message">{{ t('reader.printBlocked') }}</div>
        </div>
      </div>

      <!-- Reviews -->
      <ReviewsSection v-if="tab === 'reviews'" item-type="article" :item-id="article.id" />
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">📰</div>
      <p>{{ store.detailError && store.detailError !== 'NOT_FOUND' ? t('common.error') : t('common.notFound') }}</p>
      <button v-if="store.detailError && store.detailError !== 'NOT_FOUND'" type="button" class="btn-secondary mt-4" @click="loadArticle">
        {{ t('common.retry') }}
      </button>
    </div>
    <div v-if="toastVisible" class="protected-toast" role="status">{{ toastMessage }}</div>
    <div v-if="devToolsDetected" class="protected-warning" role="alert">
      {{ t('reader.devTools') }}
    </div>
  </div>
</template>
