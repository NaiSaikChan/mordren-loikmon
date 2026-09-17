<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { misc } from '@loikmon/api'
import type { HomeResponse, Slider } from '@loikmon/api'
import { IMAGE_STANDARDS } from '@loikmon/media-standards'
import BookCard from '@/components/shared/BookCard.vue'
import BookCarousel from '@/components/shared/BookCarousel.vue'
import ArticleCard from '@/components/shared/ArticleCard.vue'
import AuthorCard from '@/components/shared/AuthorCard.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const router = useRouter()

const home = ref<HomeResponse | null>(null)
const loading = ref(true)
const failed = ref(false)
const currentSlideIndex = ref(0)
let autoRotateTimer: ReturnType<typeof setInterval> | null = null

const sliders = () => home.value?.sliders ?? []

// Phones get the 4:5 mobile artwork only when every slide has its own (the
// server otherwise repeats the desktop artwork, which would crop badly into a
// portrait frame); the frame then switches to the mobile ratio below `sm`.
const heroMobileRatio = (() => {
  const r = IMAGE_STANDARDS.hero_mobile.aspectRatio
  return r ? `${r.width} / ${r.height}` : null
})()
const useMobileArtwork = computed(() => {
  const list = sliders()
  return !!heroMobileRatio && list.length > 0 && list.every((s) => {
    const mobile = s.mobile_image?.original ?? s.mobile_thumbnail
    const desktop = s.image?.original ?? s.thumbnail
    return !!mobile && mobile !== desktop
  })
})
// The slider spans the page width (capped by max-w-screen-xl).
const HERO_SIZES = '(min-width: 1280px) 1280px, 100vw'

function mobileSrcset(slider: Slider): string {
  return slider.mobile_image?.srcset ?? slider.mobile_image?.src ?? slider.mobile_thumbnail ?? ''
}

function nextSlide() {
  const count = sliders().length
  if (count > 0) currentSlideIndex.value = (currentSlideIndex.value + 1) % count
}

function prevSlide() {
  const count = sliders().length
  if (count > 0) currentSlideIndex.value = (currentSlideIndex.value - 1 + count) % count
}

function goToSlide(index: number) {
  if (index >= 0 && index < sliders().length) currentSlideIndex.value = index
}

function handleSliderClick(slider: Slider) {
  if (!slider.link) return
  // In-app links navigate within the SPA; everything else opens in a new tab.
  if (slider.link.startsWith('/') && !slider.link.startsWith('//')) void router.push(slider.link)
  else window.open(slider.link, '_blank', 'noopener')
}

async function load() {
  loading.value = true
  failed.value = false
  try {
    const { data } = await misc.home()
    home.value = data
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }

  if (autoRotateTimer) clearInterval(autoRotateTimer)
  if (sliders().length > 1) autoRotateTimer = setInterval(nextSlide, 5000)
}

onMounted(load)

onUnmounted(() => {
  if (autoRotateTimer) {
    clearInterval(autoRotateTimer)
    autoRotateTimer = null
  }
})
</script>

<template>
  <div class="page-wrapper">
    <LoadingSpinner v-if="loading && !home" />

    <div v-else-if="failed && !home" class="card p-10 text-center text-gray-500 dark:text-gray-400">
      <div class="text-5xl mb-3">⚠️</div>
      <p class="mb-4">{{ t('home.loadError') }}</p>
      <button type="button" class="btn-primary" @click="load">{{ t('common.retry') }}</button>
    </div>

    <template v-else-if="home">
      <!-- Sliders Carousel -->
      <div v-if="home.sliders.length" class="mb-8 rounded-2xl overflow-hidden bg-gray-100 dark:bg-surface-800 shadow-lg">
        <div
          class="relative w-full aspect-16/6 md:aspect-16/5 overflow-hidden bg-gray-200 dark:bg-surface-700"
          :class="{ 'max-sm:aspect-(--hero-mobile-ratio)': useMobileArtwork }"
          :style="useMobileArtwork ? { '--hero-mobile-ratio': heroMobileRatio ?? undefined } : undefined"
        >
          <div class="relative w-full h-full">
            <button
              v-for="(slider, idx) in home.sliders"
              :key="slider.id"
              type="button"
              :aria-current="idx === currentSlideIndex ? 'true' : 'false'"
              :aria-label="slider.title || slider.name || `Slide ${idx + 1}`"
              class="absolute inset-0 w-full h-full cursor-pointer transition-opacity duration-500"
              :class="idx === currentSlideIndex ? 'opacity-100 visible' : 'opacity-0 invisible'"
              @click="handleSliderClick(slider)"
            >
              <picture v-if="slider.image?.src || slider.thumbnail" class="block w-full h-full">
                <source
                  v-if="useMobileArtwork"
                  media="(max-width: 639px)"
                  :srcset="mobileSrcset(slider)"
                  sizes="100vw"
                />
                <img
                  :src="slider.image?.src || slider.thumbnail || ''"
                  :srcset="(slider.image?.src && slider.image.srcset) || undefined"
                  :sizes="slider.image?.srcset ? HERO_SIZES : undefined"
                  :alt="slider.title || slider.name || `Slider ${idx + 1}`"
                  class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  :loading="idx === 0 ? 'eager' : 'lazy'"
                  :fetchpriority="idx === 0 ? 'high' : 'auto'"
                  decoding="async"
                />
              </picture>
              <div v-else class="w-full h-full flex items-center justify-center bg-gray-300 dark:bg-surface-600 text-gray-400">📸</div>
            </button>
          </div>

          <button
            v-if="home.sliders.length > 1"
            type="button"
            class="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer"
            :title="t('common.previous')"
            :aria-label="t('common.previous')"
            @click.stop="prevSlide"
          >←</button>
          <button
            v-if="home.sliders.length > 1"
            type="button"
            class="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer"
            :title="t('common.next')"
            :aria-label="t('common.next')"
            @click.stop="nextSlide"
          >→</button>

          <div v-if="home.sliders.length > 1" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            <button
              v-for="(_, idx) in home.sliders"
              :key="`indicator-${idx}`"
              type="button"
              class="w-2 h-2 rounded-full transition-all cursor-pointer"
              :class="idx === currentSlideIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/75'"
              :aria-label="`Go to slide ${idx + 1}`"
              @click.stop="goToSlide(idx)"
            />
          </div>
        </div>
      </div>

      <!-- Latest books -->
      <template v-if="home.latest_books.length">
        <SectionHeader :title="t('home.latestBooks')" :viewAllPath="'/books'" />
        <div class="content-grid mb-8">
          <BookCard v-for="book in home.latest_books.slice(0, 12)" :key="book.id" :book="book" />
        </div>
      </template>

      <BookCarousel v-if="home.popular_books.length" :title="t('home.popularBooks')" :books="home.popular_books" class="mb-8" />
      <BookCarousel v-if="home.recommended_books.length" :title="t('home.recommendedBooks')" :books="home.recommended_books" class="mb-8" />

      <template v-if="home.audio_books.length">
        <SectionHeader :title="`🎧 ${t('home.audioBooks')}`" :viewAllPath="'/audiobooks'" />
        <BookCarousel :books="home.audio_books" class="mb-8" />
      </template>

      <!-- Articles -->
      <template v-if="home.articles.length">
        <SectionHeader :title="t('home.latestArticles')" :viewAllPath="'/articles'" />
        <div class="space-y-3 mb-8">
          <ArticleCard v-for="article in home.articles.slice(0, 5)" :key="article.id" :article="article" />
        </div>
      </template>

      <!-- Authors -->
      <template v-if="home.authors.length">
        <SectionHeader :title="t('home.authors')" :viewAllPath="'/authors'" />
        <div class="authors-grid mb-8">
          <AuthorCard v-for="author in home.authors.slice(0, 10)" :key="author.id" :author="author" />
        </div>
      </template>
    </template>
  </div>
</template>
