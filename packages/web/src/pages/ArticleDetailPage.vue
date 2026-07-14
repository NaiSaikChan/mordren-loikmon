<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useArticlesStore } from '@/stores/articles'
import { useReviewsStore } from '@/stores/reviews'
import { useAuthStore } from '@/stores/auth'
import { usePurchasesStore } from '@/stores/purchases'
import { articles as articlesApi } from '@loikmon/api'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store  = useArticlesStore()
const reviews = useReviewsStore()
const auth   = useAuthStore()
const purchasesStore = usePurchasesStore()

const article  = computed(() => store.detail)
const tab      = ref<'content' | 'reviews'>('content')
const newReview  = ref('')
const newRating  = ref(5)
const submitting = ref(false)
const reviewMsg  = ref('')
const isPurchasing = ref(false)
const purchaseMsg  = ref('')

const isPaid = computed(() => {
  if (!article.value) return false
  if (article.value.is_free) return false
  return Number(article.value.price ?? article.value.amount ?? 0) > 0
})

const canRead = computed(() => {
  if (!article.value) return false
  if (!isPaid.value) return true
  if (!auth.isLoggedIn) return false
  return purchasesStore.hasArticle(props.id)
})

function fixUrl(url?: string) {
  if (!url) return ''
  return url.replace(/\\/g, '/').replace(/ /g, '%20').replace(/\u202f/gi, '%20')
}

async function submitReview() {
  if (!newReview.value.trim()) return
  submitting.value = true
  try {
    await reviews.submitReview(props.id, 'article', newReview.value, newRating.value)
    newReview.value = ''
    reviewMsg.value = 'Review submitted!'
  } catch { reviewMsg.value = 'Failed' }
  finally { submitting.value = false }
}

async function buyArticle() {
  isPurchasing.value = true
  purchaseMsg.value  = ''
  try {
    await purchasesStore.purchaseArticle(props.id, Number(article.value?.price ?? article.value?.amount ?? 0))
    purchaseMsg.value = 'Purchase successful! You can now read this article.'
  } catch (e: any) {
    purchaseMsg.value = e.message ?? 'Purchase failed. Please check your coin balance.'
  } finally {
    isPurchasing.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    store.fetchDetail(props.id),
    auth.isLoggedIn ? purchasesStore.fetchAll() : Promise.resolve(),
  ])
  reviews.loadReviews(props.id, 'article')
  articlesApi.updateArticleTotalViews(props.id)
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
      <div v-if="fixUrl(article.thumbnail_url ?? article.thumbnail)"
        class="w-full h-52 rounded-2xl overflow-hidden mb-6 bg-gray-100 dark:bg-surface-800">
        <img :src="fixUrl(article.thumbnail_url ?? article.thumbnail)" :alt="article.title"
          class="w-full h-full object-cover"
          @error="($event.target as HTMLImageElement).style.display='none'" />
      </div>

      <!-- Meta -->
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">{{ article.title }}</h1>
      <div class="flex items-center gap-3 text-sm text-gray-400 mb-6 flex-wrap">
        <span v-if="article.author">✍️ {{ article.author }}</span>
        <span v-if="article.category ?? article.cat">📂 {{ article.category ?? article.cat }}</span>
        <span v-if="article.created_at ?? article.date">📅 {{ new Date(article.created_at ?? article.date ?? '').toLocaleDateString() }}</span>
        <span v-if="article.is_free" class="text-green-500 font-semibold">Free</span>
        <span v-else-if="article.price ?? article.amount" class="text-brand-600 font-semibold">🪙 {{ article.price ?? article.amount }}</span>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'content' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'content'">Content</button>
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'reviews' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'reviews'">Reviews ({{ reviews.list.length }})</button>
      </div>

      <!-- Content -->
      <div v-if="tab === 'content'" class="card p-6">
        <!-- Locked: paid article not yet purchased -->
        <div v-if="!canRead" class="text-center py-10">
          <div class="text-4xl mb-3">🔒</div>
          <p class="font-semibold text-gray-700 dark:text-gray-200 mb-2">This article requires purchase</p>
          <p class="text-sm text-gray-400 mb-5">🪙 {{ article.price ?? article.amount }} coins for full access</p>
          <button v-if="auth.isLoggedIn" class="btn-primary" @click="buyArticle"
            :disabled="purchasesStore.buyLoading || isPurchasing">
            {{ purchasesStore.buyLoading || isPurchasing ? 'Purchasing…' : `🪙 Buy for ${article.price ?? article.amount} coins` }}
          </button>
          <RouterLink v-else to="/auth" class="btn-primary inline-flex">🔐 Login to Read</RouterLink>
          <p v-if="purchaseMsg" class="text-sm mt-3"
            :class="purchaseMsg.includes('successful') ? 'text-green-500' : 'text-red-400'">
            {{ purchaseMsg }}
          </p>
        </div>
        <!-- Content available -->
        <div v-else
          class="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line"
          v-html="article.content ?? article.description ?? article.body ?? 'No content available.'">
        </div>
      </div>

      <!-- Reviews -->
      <div v-if="tab === 'reviews'">
        <div v-if="auth.isLoggedIn" class="card p-5 mb-6">
          <h3 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">Write a Review</h3>
          <div class="flex gap-1 mb-3">
            <button v-for="s in 5" :key="s"
              :class="['text-2xl transition-transform hover:scale-110', s <= newRating ? 'text-yellow-400' : 'text-gray-300']"
              @click="newRating = s">★</button>
          </div>
          <textarea v-model="newReview" class="input w-full h-24 resize-none" placeholder="Share your thoughts..." />
          <div class="flex items-center justify-between mt-3">
            <p v-if="reviewMsg" class="text-sm text-green-500">{{ reviewMsg }}</p>
            <button class="btn-primary ml-auto" :disabled="submitting" @click="submitReview">
              {{ submitting ? 'Submitting...' : 'Submit' }}
            </button>
          </div>
        </div>

        <div v-if="reviews.list.length" class="space-y-4">
          <div v-for="r in reviews.list" :key="r.id" class="card p-4">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0 font-bold text-brand-600">
                {{ (r.author_name ?? r.username ?? 'U').charAt(0) }}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-gray-900 dark:text-white">{{ r.author_name ?? r.username }}</span>
                  <span class="text-yellow-400 text-xs">{{ '★'.repeat(r.rating ?? 0) }}</span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">{{ r.content ?? r.comment }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-400">No reviews yet.</div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">📰</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
