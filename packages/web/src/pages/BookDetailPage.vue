<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { books as booksApi } from '@loikmon/api'
import type { Book } from '@loikmon/api'
import { useBooksStore } from '@/stores/books'
import { useReviewsStore } from '@/stores/reviews'
import { useAuthStore } from '@/stores/auth'
import { useBookAudioStore } from '@/stores/bookAudio'
import { usePaywallStore } from '@/stores/paywall'
import { playAudio } from '@/composables/audioPlayback'
import { lockReasonFromAccess } from '@/utils/access'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import BookCarousel from '@/components/shared/BookCarousel.vue'
import AccessBadge from '@/components/shared/AccessBadge.vue'
import Paywall from '@/components/shared/Paywall.vue'
import SaveButton from '@/components/shared/SaveButton.vue'
import ReviewsSection from '@/components/shared/ReviewsSection.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useBooksStore()
const reviews = useReviewsStore()
const auth = useAuthStore()
const audioStore = useBookAudioStore()
const paywall = usePaywallStore()

const authorBooks = ref<Book[]>([])
const tab = ref<'details' | 'reviews'>('details')

const book = computed(() => (store.detail && String(store.detail.id) === String(props.id) ? store.detail : null))
const cover = computed(() => book.value?.thumbnail ?? book.value?.cover_url ?? book.value?.coverphoto ?? '')

/** Formats come from the book; whether they can be opened comes from `book.access` (server decision). */
const formats = computed<Array<'epub' | 'pdf'>>(() => {
  const b = book.value
  if (!b) return []
  const list = new Set(b.formats ?? [])
  if (b.has_epub) list.add('epub')
  if (b.has_pdf) list.add('pdf')
  return (['epub', 'pdf'] as const).filter((f) => list.has(f))
})
const lockReason = computed(() => lockReasonFromAccess(book.value?.access))
const canRead = computed(() => Boolean(book.value?.access?.granted))

const audioBookId = computed(() => (audioStore.bookId === String(props.id) ? audioStore.bookId : null))
const audioTracks = computed(() => (audioBookId.value ? audioStore.tracks : []))
const playableTracks = computed(() => (audioBookId.value ? audioStore.playableTracks : []))
const lockedChapters = computed(() => (audioBookId.value ? audioStore.lockedCount : 0))

function startAudioPlayer() {
  const [first] = playableTracks.value
  if (!first) {
    paywall.open(audioStore.lockReason)
    return
  }
  playAudio(first, audioTracks.value)
}

async function loadAuthorBooks(current: Book) {
  authorBooks.value = []
  if (!current.author_id) return
  try {
    const { data } = await booksApi.fetchBooks({ author: current.author_id, limit: 12 })
    authorBooks.value = (data.books ?? []).filter((b) => String(b.id) !== String(current.id))
  } catch { /* optional section */ }
}

async function loadBook() {
  tab.value = 'details'
  const current = await store.fetchDetail(props.id)
  if (!current) return
  void booksApi.updateTotalViews(props.id).catch(() => undefined)
  void store.fetchRelated(props.id)
  void loadAuthorBooks(current)
  void reviews.loadReviews('book', props.id)
  if (current.has_audio) {
    void audioStore.fetchChapters(props.id, { title: current.title, author: current.authorname, cover: current.thumbnail })
  } else {
    audioStore.clear()
  }
}

/** Access (and signed chapter URLs) depend on the session: reload them when it changes. */
async function reloadAccess() {
  const current = await store.fetchDetail(props.id)
  if (current?.has_audio) {
    void audioStore.fetchChapters(props.id, { title: current.title, author: current.authorname, cover: current.thumbnail })
  }
}

onMounted(loadBook)
watch(() => props.id, loadBook)
watch(() => [auth.token, Boolean(auth.entitlement?.active)] as const, (next, prev) => {
  // A different session, or an entitlement change while the book is locked.
  if (next[0] !== prev[0] || (next[1] !== prev[1] && lockReason.value)) void reloadAccess()
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
            <div class="aspect-3/4 rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-800 shadow-lg">
              <img v-if="cover"
                :src="cover"
                :alt="book.title"
                class="w-full h-full object-cover"
                loading="eager"
                fetchpriority="high"
                decoding="async" />
              <div v-else class="w-full h-full flex items-center justify-center text-5xl">📚</div>
            </div>
          </div>
          <!-- Info -->
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ book.title }}</h1>
            <RouterLink
              v-if="book.author_id && book.authorname"
              :to="`/authors/${book.author_id}`"
              class="text-brand-600 dark:text-brand-400 text-sm font-medium mb-1 inline-block hover:underline"
            >{{ book.authorname }}</RouterLink>
            <p v-else-if="book.authorname" class="text-brand-600 dark:text-brand-400 text-sm font-medium mb-1">{{ book.authorname }}</p>
            <p v-if="book.categoryname" class="text-xs text-gray-400 mb-3">
              <RouterLink v-if="book.category" :to="`/categories/${book.category}`" class="hover:underline">📂 {{ book.categoryname }}</RouterLink>
              <span v-else>📂 {{ book.categoryname }}</span>
            </p>

            <!-- Stats row -->
            <div class="flex items-center gap-4 text-xs text-gray-400 mb-4 flex-wrap">
              <span v-if="book.pages">📄 {{ t('books.pages', { count: book.pages }) }}</span>
              <span v-if="book.rating">⭐ {{ Number(book.rating).toFixed(1) }}/5</span>
              <span v-if="book.views">👁 {{ t('books.views', { count: book.views }) }}</span>
              <AccessBadge :item="book" size="sm" />
              <span
                v-for="f in formats"
                :key="f"
                :class="['inline-block text-xs font-medium px-2 py-0.5 rounded-full', f === 'epub' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300']"
              >{{ f.toUpperCase() }}</span>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 flex-wrap items-center">
              <template v-if="canRead">
                <RouterLink
                  v-for="f in formats"
                  :key="f"
                  :to="{ path: `/books/${props.id}/read`, query: { format: f } }"
                  class="btn-primary"
                  :data-testid="`read-${f}`"
                >
                  {{ f === 'epub' ? `📖 ${t('books.readEpub')}` : `📄 ${t('books.readPdf')}` }}
                </RouterLink>
              </template>

              <button
                v-if="playableTracks.length"
                type="button"
                class="btn-primary"
                data-testid="listen"
                @click="startAudioPlayer"
              >
                🎧 {{ lockedChapters ? t('books.listenPreview', { count: playableTracks.length }) : t('books.listenChapters', { count: playableTracks.length }) }}
              </button>
              <button
                v-else-if="audioTracks.length"
                type="button"
                class="btn-secondary"
                data-testid="listen-locked"
                @click="startAudioPlayer"
              >
                🔒 🎧 {{ t('books.listenChapters', { count: audioTracks.length }) }}
              </button>

              <SaveButton item-type="book" :item-id="book.id" :in-library="book.in_library" @change="store.setInLibrary" />
            </div>

            <p v-if="canRead && !formats.length && !book.has_audio" class="mt-3 text-sm text-gray-400">{{ t('books.noFormats') }}</p>
            <p v-if="lockedChapters && playableTracks.length" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
              🔒 {{ t('books.lockedChapters', { count: lockedChapters }) }}
            </p>

            <!-- Server says no: sign in or subscribe -->
            <Paywall
              v-if="lockReason && (formats.length || book.has_audio)"
              :reason="lockReason"
              compact
              class="mt-4"
              @unlocked="reloadAccess"
            />
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'details' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'details'">{{ t('books.detailsTab') }}</button>
        <button :class="['px-4 py-2 rounded-xl text-sm font-medium', tab === 'reviews' ? 'bg-brand-600 text-white' : 'btn-ghost']"
          @click="tab = 'reviews'">{{ t('reviews.tab', { count: reviews.summary.count || reviews.list.length }) }}</button>
      </div>

      <!-- Details tab -->
      <div v-if="tab === 'details'">
        <div v-if="book.description" class="card p-5 mb-6">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">{{ t('books.description') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {{ book.description }}
          </p>
        </div>

        <BookCarousel
          v-if="authorBooks.length"
          :title="t('books.authorBooks')"
          :books="authorBooks"
          class="mb-8"
        />

        <BookCarousel
          v-if="store.related.length"
          :title="t('books.youMayLike')"
          :books="store.related"
          class="mb-8"
        />
      </div>

      <!-- Reviews tab -->
      <ReviewsSection v-if="tab === 'reviews'" item-type="book" :item-id="book.id" />
    </div>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">📚</div>
      <p>{{ store.detailError && store.detailError !== 'NOT_FOUND' ? t('common.error') : t('common.notFound') }}</p>
      <button v-if="store.detailError && store.detailError !== 'NOT_FOUND'" type="button" class="btn-secondary mt-4" @click="loadBook">
        {{ t('common.retry') }}
      </button>
    </div>
  </div>
</template>
