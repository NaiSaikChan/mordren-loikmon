<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBooksStore } from '@/stores/books'
import { useReviewsStore } from '@/stores/reviews'
import { useAuthStore } from '@/stores/auth'
import { books as booksApi } from '@loikmon/api'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import BookCard from '@/components/shared/BookCard.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store  = useBooksStore()
const reviews = useReviewsStore()
const auth   = useAuthStore()

const book    = computed(() => store.detail)
const tab     = ref<'details' | 'reviews'>('details')
const newReview = ref('')
const newRating = ref(5)
const submitting = ref(false)
const reviewMsg  = ref('')

function fixUrl(url?: string) {
  if (!url) return ''
  return url.replace(/\\/g, '/').replace(/ /g, '%20').replace(/\u202f/gi, '%20')
}

function coverUrl(book: any) {
  for (const k of ['thumbnail', 'coverphoto', 'cover_url', 'cover']) {
    if (book[k]) return fixUrl(book[k])
  }
  return ''
}

function openReader() {
  window.open(`/mordren-loikmon/reader/${props.id}`, '_blank')
}

async function submitReview() {
  if (!newReview.value.trim()) return
  submitting.value = true
  try {
    await reviews.submitReview(props.id, 'book', newReview.value, newRating.value)
    newReview.value = ''
    reviewMsg.value = 'Review submitted!'
  } catch { reviewMsg.value = 'Failed to submit' }
  finally { submitting.value = false }
}

onMounted(async () => {
  await store.fetchDetail(props.id)
  await reviews.loadReviews(props.id, 'book')
  booksApi.updateTotalViews(props.id)
  if (book.value) store.fetchRelated(props.id)
})
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
            <div class="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-800 shadow-lg">
              <img v-if="coverUrl(book)" :src="coverUrl(book)" :alt="book.title"
                class="w-full h-full object-cover"
                @error="($event.target as HTMLImageElement).style.display='none'" />
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
              📂 {{ book.category ?? book.cat }}
            </p>

            <!-- Stats row -->
            <div class="flex items-center gap-4 text-xs text-gray-400 mb-4 flex-wrap">
              <span v-if="book.pages ?? book.pagecount">📄 {{ book.pages ?? book.pagecount }} pages</span>
              <span v-if="book.rating">⭐ {{ book.rating }}/5</span>
              <span v-if="book.views ?? book.total_views">👁 {{ book.views ?? book.total_views }} views</span>
              <span v-if="book.is_free" class="text-green-500 font-semibold">Free</span>
              <span v-else-if="book.price" class="text-brand-600 font-semibold">🪙 {{ book.price }} coins</span>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-3 flex-wrap">
              <button v-if="book.pdf ?? book.pdffile" class="btn-primary" @click="openReader">
                📖 Read Now
              </button>
              <a v-if="book.pdf ?? book.pdffile" :href="fixUrl(book.pdf ?? book.pdffile)"
                target="_blank" class="btn-secondary">
                ⬇️ Download PDF
              </a>
              <RouterLink v-if="store.chapters.length" :to="`/books/${props.id}/reader`" class="btn-secondary">
                📑 Chapters ({{ store.chapters.length }})
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'details' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'details'">Details</button>
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'reviews' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'reviews'">Reviews ({{ reviews.list.length }})</button>
      </div>

      <!-- Details tab -->
      <div v-if="tab === 'details'">
        <div v-if="book.description ?? book.about" class="card p-5 mb-6">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">About</h2>
          <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {{ book.description ?? book.about }}
          </p>
        </div>

        <!-- Related books -->
        <div v-if="store.related.length">
          <h2 class="section-title">Related Books</h2>
          <div class="content-grid">
            <BookCard v-for="b in store.related.slice(0, 6)" :key="b.id" :book="b" />
          </div>
        </div>
      </div>

      <!-- Reviews tab -->
      <div v-if="tab === 'reviews'">
        <!-- Submit review -->
        <div v-if="auth.isLoggedIn" class="card p-5 mb-6">
          <h3 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">Write a Review</h3>
          <!-- Star rating -->
          <div class="flex gap-1 mb-3">
            <button v-for="s in 5" :key="s"
              :class="['text-2xl transition-transform hover:scale-110', s <= newRating ? 'text-yellow-400' : 'text-gray-300']"
              @click="newRating = s">★</button>
          </div>
          <textarea v-model="newReview" class="input w-full h-24 resize-none" placeholder="Share your thoughts..." />
          <div class="flex items-center justify-between mt-3">
            <p v-if="reviewMsg" class="text-sm text-green-500">{{ reviewMsg }}</p>
            <button class="btn-primary ml-auto" :disabled="submitting || !newReview.trim()" @click="submitReview">
              {{ submitting ? 'Submitting...' : 'Submit Review' }}
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
        <div v-else class="text-center py-8 text-gray-400">No reviews yet. Be the first!</div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">📚</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
