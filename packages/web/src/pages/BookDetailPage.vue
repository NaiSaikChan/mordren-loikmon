<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBooksStore } from '@/stores/books'
import { useReviewsStore } from '@/stores/reviews'
import { useAuthStore } from '@/stores/auth'
import { usePurchasesStore } from '@/stores/purchases'
import { useBookAudioStore } from '@/stores/bookAudio'
import { books as booksApi } from '@loikmon/api'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import BookCard from '@/components/shared/BookCard.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store  = useBooksStore()
const reviews = useReviewsStore()
const auth   = useAuthStore()
const purchasesStore = usePurchasesStore()
const audioStore = useBookAudioStore()

const book    = computed(() => store.detail)
const cover   = computed(() => {
  if (!book.value) return ''
  return fixUrl(book.value.thumbnail ?? book.value.coverphoto ?? book.value.cover_url ?? book.value.cover ?? '')
})
const tab          = ref<'details' | 'reviews'>('details')
const coverError   = ref(false)
const newReview    = ref('')
const newRating    = ref(5)
const submitting   = ref(false)
const reviewMsg    = ref('')
const isPurchasing = ref(false)
const purchaseMsg  = ref('')
const purchaseSuccess = ref(false)
const bookCoupon        = ref('')
const bookCouponMsg     = ref('')
const bookCouponLoading = ref(false)
const bookCouponSuccess = ref(false)

// A book is paid if it has a positive price and is not flagged free
const isPaid = computed(() => {
  if (!book.value) return false
  if (book.value.is_free) return false
  return Number(book.value.price ?? book.value.amount ?? 0) > 0
})

// User can read when: book is free/no price, OR they purchased it
const canRead = computed(() => {
  if (!book.value) return false
  if (!isPaid.value) return true
  if (!auth.isLoggedIn) return false
  return purchasesStore.hasBook(props.id)
})

function fixUrl(url?: string) {
  if (!url) return ''
  return url.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
}

async function submitReview() {
  if (!newReview.value.trim()) return
  submitting.value = true
  try {
    await reviews.submitReview(props.id, 'book', newReview.value, newRating.value)
    newReview.value = ''
    reviewMsg.value = t('books.reviewSubmitted')
  } catch { reviewMsg.value = t('books.reviewSubmitFailed') }
  finally { submitting.value = false }
}

async function buyBook() {
  isPurchasing.value = true
  purchaseMsg.value  = ''
  purchaseSuccess.value = false
  try {
    await purchasesStore.purchaseBook(props.id, Number(book.value?.price ?? book.value?.amount ?? 0))
    purchaseSuccess.value = true
    purchaseMsg.value = t('books.purchaseSuccess')
  } catch (e: any) {
    purchaseMsg.value = e.message ?? t('books.purchaseFailed')
  } finally {
    isPurchasing.value = false
  }
}

async function redeemBookCoupon() {
  if (!bookCoupon.value.trim()) return
  bookCouponLoading.value = true
  bookCouponMsg.value = ''
  bookCouponSuccess.value = false
  try {
    const res = await purchasesStore.redeemCoupon(bookCoupon.value.trim(), props.id)
    const body = res as any
    if (body?.status === 'ok') {
      bookCouponSuccess.value = true
      bookCouponMsg.value = body?.message ?? body?.msg ?? t('books.couponSuccess')
      bookCoupon.value = ''
      await purchasesStore.fetchAll()
    } else {
      bookCouponMsg.value = body?.message ?? body?.msg ?? t('books.couponInvalid')
    }
  } catch (e: any) {
    bookCouponMsg.value = e?.message ?? t('books.couponError')
  } finally {
    bookCouponLoading.value = false
  }
}

function startAudioPlayer() {
  if (!audioStore.tracks.length) return
  window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', {
    detail: { track: audioStore.tracks[0], queue: audioStore.tracks },
  }))
}

async function loadBook() {
  coverError.value = false
  await store.fetchDetail(props.id)
  await reviews.loadReviews(props.id, 'book')
  booksApi.updateTotalViews(props.id)
  if (book.value) store.fetchRelated(props.id)
  if (auth.isLoggedIn) purchasesStore.fetchAll()
  if (book.value) audioStore.fetchChapters(props.id, book.value.title)
}

onMounted(loadBook)

// Handle route param changes (navigating between different books)
watch(() => props.id, loadBook)
</script>

<template>
  <div class="page-wrapper">
    <RouterLink to="/books" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← {{ t('books.title') }}
    </RouterLink>

    <LoadingSpinner v-if="store.loading && !book" />

    <div v-else-if="book">
      <!-- Hero -->
      <div class="card overflow-hidden mb-6">
        <div class="flex flex-col sm:flex-row gap-6 p-6">
          <!-- Cover -->
          <div class="w-full sm:w-40 shrink-0">
            <div class="aspect-3/4 rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-800 shadow-lg">
              <img v-if="cover" 
                :src="cover" 
                :alt="book.title"
                class="w-full h-full object-cover"
                @error="coverError = true" />
              <div v-else class="w-full h-full flex items-center justify-center text-5xl">📚</div>
            </div>
          </div>
          <!-- Info -->
          <div class="flex-1">
            <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ book.title }}</h1>
            <p class="text-brand-600 dark:text-brand-400 text-sm font-medium mb-1">
              {{ book.authorname ?? book.author }}
            </p>
            <p v-if="book.category ?? book.cat" class="text-xs text-gray-400 mb-3">
              📂 {{ book.categoryname ?? book.cat }}
            </p>

            <!-- Stats row -->
            <div class="flex items-center gap-4 text-xs text-gray-400 mb-4 flex-wrap">
              <span v-if="book.pages ?? book.pagecount">📄 {{ t('books.pages', { count: book.pages ?? book.pagecount }) }}</span>
              <span v-if="book.rating">⭐ {{ book.rating }}/5</span>
              <span v-if="book.views ?? book.total_views">👁 {{ t('books.views', { count: book.views ?? book.total_views }) }}</span>
              <span v-if="book.is_free" class="text-green-500 font-semibold">{{ t('books.free') }}</span>
              <span v-else-if="book.price ?? book.amount" class="text-brand-600 font-semibold">🪙 {{ book.price ?? book.amount }} coins</span>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-3 flex-wrap items-center">
              <!-- Free / purchased: show read buttons -->
              <template v-if="canRead">
                <template v-if="book.epub">
                  <RouterLink :to="`/books/${props.id}/read?format=epub`" class="btn-primary">
                    📖 {{ t('books.readEpub') }}
                  </RouterLink>
                  <span class="inline-block text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    EPUB
                  </span>
                </template>
                <template v-if="book.pdf || book.pdffile">
                  <RouterLink :to="`/books/${props.id}/read?format=pdf`" class="btn-primary">
                    📄 {{ t('books.readPdf') }}
                  </RouterLink>
                  <span class="inline-block text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                    PDF
                  </span>
                </template>
                <RouterLink v-if="store.chapters.length" :to="`/books/${props.id}/read`" class="btn-secondary">
                  📑 {{ t('books.chaptersCount', { count: store.chapters.length }) }}
                </RouterLink>
                <button
                  v-if="audioStore.tracks.length"
                  class="btn-primary"
                  @click="startAudioPlayer">
                  🎧 {{ t('books.listenChapters', { count: audioStore.tracks.length }) }}
                </button>
              </template>
              <!-- Paid & not purchased: show buy / login prompt -->
              <template v-else-if="isPaid">
                <button v-if="auth.isLoggedIn" class="btn-primary" @click="buyBook"
                  :disabled="purchasesStore.buyLoading || isPurchasing">
                  {{ purchasesStore.buyLoading || isPurchasing ? t('books.purchasing') : `🪙 ${t('books.buyForCoins', { amount: book.price ?? book.amount })}` }}
                </button>
                <RouterLink v-else to="/auth" class="btn-primary">
                  🔐 {{ t('books.loginToRead') }}
                </RouterLink>
                <p v-if="purchaseMsg" class="text-sm w-full mt-1"
                  :class="purchaseSuccess ? 'text-green-500' : 'text-red-400'">
                  {{ purchaseMsg }}
                </p>
                <!-- Book Coupon (only for logged-in users who haven't purchased) -->
                <div v-if="auth.isLoggedIn" class="w-full mt-3 pt-3 border-t border-gray-100 dark:border-surface-700">
                  <p class="text-xs text-gray-400 dark:text-gray-500 mb-2">🎫 {{ t('books.couponPrompt') }}</p>
                  <div class="flex gap-2">
                    <input
                      v-model="bookCoupon"
                      class="input flex-1"
                      :placeholder="t('books.couponPlaceholder')"
                      @keyup.enter="redeemBookCoupon"
                    />
                    <button
                      class="btn-ghost whitespace-nowrap"
                      :disabled="!bookCoupon.trim() || bookCouponLoading"
                      @click="redeemBookCoupon">
                      {{ bookCouponLoading ? '…' : t('purchases.redeemAction') }}
                    </button>
                  </div>
                  <p v-if="bookCouponMsg" class="text-xs mt-1.5"
                    :class="bookCouponSuccess ? 'text-green-500' : 'text-red-400'">
                    {{ bookCouponMsg }}
                  </p>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'details' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'details'">{{ t('books.detailsTab') }}</button>
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'reviews' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'reviews'">{{ t('books.reviewsTab', { count: reviews.list.length }) }}</button>
      </div>

      <!-- Details tab -->
      <div v-if="tab === 'details'">
        <div v-if="book.description ?? book.about" class="card p-5 mb-6">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">{{ t('books.description') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {{ book.description ?? book.about }}
          </p>
        </div>

        <!-- Related books -->
        <div v-if="store.related.length">
          <h2 class="section-title">{{ t('books.related') }}</h2>
          <div class="content-grid">
            <BookCard v-for="b in store.related.slice(0, 6)" :key="b.id" :book="b" />
          </div>
        </div>
      </div>

      <!-- Reviews tab -->
      <div v-if="tab === 'reviews'">
        <!-- Submit review -->
        <div v-if="auth.isLoggedIn" class="card p-5 mb-6">
          <h3 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">{{ t('books.writeReview') }}</h3>
          <!-- Star rating -->
          <div class="flex gap-1 mb-3">
            <button v-for="s in 5" :key="s"
              :class="['text-2xl transition-transform hover:scale-110', s <= newRating ? 'text-yellow-400' : 'text-gray-300']"
              @click="newRating = s">★</button>
          </div>
          <textarea v-model="newReview" class="input w-full h-24 resize-none" :placeholder="t('books.reviewPlaceholder')" />
          <div class="flex items-center justify-between mt-3">
            <p v-if="reviewMsg" class="text-sm text-green-500">{{ reviewMsg }}</p>
            <button class="btn-primary ml-auto" :disabled="submitting || !newReview.trim()" @click="submitReview">
              {{ submitting ? t('purchases.submitting') : t('books.submitReview') }}
            </button>
          </div>
        </div>

        <!-- Reviews list -->
        <div v-if="reviews.list.length" class="space-y-4">
          <div v-for="r in reviews.list" :key="r.id" class="card p-4">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0 font-bold text-brand-600">
                {{ (r.author_name ?? r.username ?? 'U').charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-gray-900 dark:text-white">{{ r.author_name ?? r.username }}</span>
                  <span class="text-yellow-400 text-xs">{{ '★'.repeat(r.rating ?? 0) }}</span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">{{ r.content ?? r.comment }}</p>
                <p v-if="r.created_at" class="text-xs text-gray-400 mt-1">{{ new Date(r.created_at).toLocaleDateString() }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-400">{{ t('books.noReviews') }}</div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">📚</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
