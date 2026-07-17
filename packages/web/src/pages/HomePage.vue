<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBooksStore } from '@/stores/books'
import { useArticlesStore } from '@/stores/articles'
import { useAuthStore } from '@/stores/auth'
import { misc } from '@loikmon/api'
import BookCard from '@/components/shared/BookCard.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const booksStore   = useBooksStore()
const articlesStore = useArticlesStore()
const authStore    = useAuthStore()

const sliders   = ref<any[]>([])
const leagues   = ref<any[]>([])
const initDone  = ref(false)
const currentSlideIndex = ref(0)

const currentSlide = computed(() => sliders.value[currentSlideIndex.value] || null)

function nextSlide() {
  if (sliders.value.length > 0) {
    currentSlideIndex.value = (currentSlideIndex.value + 1) % sliders.value.length
  }
}

function prevSlide() {
  if (sliders.value.length > 0) {
    currentSlideIndex.value = (currentSlideIndex.value - 1 + sliders.value.length) % sliders.value.length
  }
}

function goToSlide(index: number) {
  if (index >= 0 && index < sliders.value.length) {
    currentSlideIndex.value = index
  }
}

function handleSliderClick(slider: any) {
  if (slider.link) {
    window.open(slider.link, '_blank')
  }
}

onMounted(async () => {
  try {
    const res = await misc.initApp(authStore.user?.email as string)
    const body = res.data as any
    sliders.value = body.sliders ?? []
    leagues.value = body.leagues ?? []

    if (body.books?.length)    booksStore.list    = body.books
    if (body.articles?.length) articlesStore.list = body.articles
  } catch { /* fallback to individual fetches */ }

  if (!booksStore.list.length)    booksStore.fetchBooks()
  if (!articlesStore.list.length) articlesStore.fetchArticles()
  initDone.value = true

  // Auto-rotate sliders every 5 seconds
  if (sliders.value.length > 1) {
    const autoRotate = setInterval(() => {
      nextSlide()
    }, 5000)
    return () => clearInterval(autoRotate)
  }
})
</script>

<template>
  <div class="page-wrapper">
    <!-- Sliders Carousel -->
    <div v-if="sliders.length" class="mb-8 rounded-2xl overflow-hidden bg-gray-100 dark:bg-surface-800 shadow-lg">
      <div class="relative w-full aspect-16/6 md:aspect-16/5 overflow-hidden bg-gray-200 dark:bg-surface-700">
        <!-- Slider Images -->
        <div class="relative w-full h-full">
          <button
            v-for="(slider, idx) in sliders"
            :key="slider.id"
            :aria-current="idx === currentSlideIndex ? 'true' : 'false'"
            class="absolute inset-0 w-full h-full cursor-pointer transition-opacity duration-500"
            :class="idx === currentSlideIndex ? 'opacity-100 visible' : 'opacity-0 invisible'"
            @click="handleSliderClick(slider)"
          >
            <img
              v-if="slider.thumbnail"
              :src="slider.thumbnail"
              :alt="slider.name || `Slider ${idx + 1}`"
              class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-gray-300 dark:bg-surface-600 text-gray-400">
              📸
            </div>
          </button>
        </div>

        <!-- Navigation Buttons -->
        <button
          v-if="sliders.length > 1"
          class="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          @click.stop="prevSlide"
          :title="t('common.previous') || 'Previous'"
        >
          ←
        </button>
        <button
          v-if="sliders.length > 1"
          class="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          @click.stop="nextSlide"
          :title="t('common.next') || 'Next'"
        >
          →
        </button>

        <!-- Pagination Indicators -->
        <div v-if="sliders.length > 1" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          <button
            v-for="(_, idx) in sliders"
            :key="`indicator-${idx}`"
            class="w-2 h-2 rounded-full transition-all"
            :class="idx === currentSlideIndex
              ? 'bg-white w-6'
              : 'bg-white/50 hover:bg-white/75'"
            @click.stop="goToSlide(idx)"
            :aria-label="`Go to slide ${idx + 1}`"
          />
        </div>
      </div>
    </div>

    <!-- Quick nav cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <RouterLink v-for="item in [
        { to: '/books',    icon: '📚', label: t('nav.books'),    color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' },
        { to: '/articles', icon: '📰', label: t('nav.articles'), color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
        { to: '/music',    icon: '🎵', label: t('nav.music'),    color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' },
        { to: '/library',  icon: '🗂️', label: t('nav.library'),  color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
      ]" :key="item.to" :to="item.to"
        :class="['card flex flex-col items-center justify-center p-4 gap-2 no-underline', item.color]">
        <span class="text-2xl">{{ item.icon }}</span>
        <span class="text-xs font-semibold">{{ item.label }}</span>
      </RouterLink>
    </div>

    <!-- Books -->
    <SectionHeader :title="t('books.title')" :viewAllPath="'/books'" />
    <LoadingSpinner v-if="booksStore.loading && !booksStore.list.length" />
    <div v-else class="content-grid mb-8">
      <BookCard v-for="book in booksStore.list.slice(0, 12)" :key="book.id" :book="book" />
    </div>

    <!-- Articles -->
    <SectionHeader :title="t('articles.title')" :viewAllPath="'/articles'" />
    <LoadingSpinner v-if="articlesStore.loading && !articlesStore.list.length" />
    <div v-else class="space-y-3">
      <ArticleCard v-for="article in articlesStore.list.slice(0, 5)" :key="article.id" :article="article" />
    </div>
  </div>
</template>
