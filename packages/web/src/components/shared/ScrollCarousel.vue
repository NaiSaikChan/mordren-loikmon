<script setup lang="ts">
import { ref } from 'vue'
import { useCarousel, type UseCarouselOptions } from '@/composables/useCarousel'

export interface ScrollCarouselProps {
  title?: string
  scrollRatio?: number
  scrollAmount?: number
  showArrows?: 'always' | 'hover' | 'never'
  showEdgeGradients?: boolean
  gapClass?: string
  contentClass?: string
  autoPlay?: boolean
  autoPlayInterval?: number
  loop?: boolean
}

const props = withDefaults(defineProps<ScrollCarouselProps>(), {
  title: undefined,
  scrollRatio: 0.8,
  scrollAmount: undefined,
  showArrows: 'hover',
  showEdgeGradients: true,
  gapClass: 'gap-3 sm:gap-4',
  contentClass: '',
  autoPlay: false,
  autoPlayInterval: 5000,
  loop: false,
})

const carouselTrack = ref<HTMLElement | null>(null)

const {
  canScrollLeft,
  canScrollRight,
  scrollPrev,
  scrollNext,
  scrollTo,
  scrollProgress,
  isScrolling,
  updateScrollState,
} = useCarousel(carouselTrack, {
  scrollRatio: () => props.scrollRatio,
  scrollAmount: () => props.scrollAmount,
  autoPlay: () => props.autoPlay,
  autoPlayInterval: () => props.autoPlayInterval,
  loop: () => props.loop,
})

defineExpose({
  scrollPrev,
  scrollNext,
  scrollTo,
  updateScrollState,
  canScrollLeft,
  canScrollRight,
  scrollProgress,
  isScrolling,
})
</script>

<template>
  <section class="relative w-full group/carousel select-none">
    <!-- Header -->
    <div v-if="title || $slots.header || $slots.actions" class="flex items-center justify-between mb-4">
      <slot name="header">
        <div class="flex items-center gap-3">
          <slot name="title">
            <h2 v-if="title" class="section-title !mb-0">{{ title }}</h2>
          </slot>
        </div>
        <div class="flex items-center gap-2">
          <slot name="actions" />

          <!-- Header Mini Controls (visible on smaller screens or always if needed) -->
          <div class="hidden sm:flex items-center gap-1.5 ml-2">
            <button
              type="button"
              class="w-8 h-8 rounded-full border border-gray-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-700 dark:text-gray-200 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xs active:scale-95 cursor-pointer"
              :disabled="!canScrollLeft"
              :aria-label="title ? `Scroll ${title} left` : 'Scroll left'"
              @click="scrollPrev"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              type="button"
              class="w-8 h-8 rounded-full border border-gray-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-700 dark:text-gray-200 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xs active:scale-95 cursor-pointer"
              :disabled="!canScrollRight"
              :aria-label="title ? `Scroll ${title} right` : 'Scroll right'"
              @click="scrollNext"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </slot>
    </div>

    <!-- Carousel Body -->
    <div class="relative">
      <!-- Left Floating Navigation Arrow -->
      <button
        v-if="showArrows !== 'never'"
        type="button"
        class="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 dark:bg-surface-800/90 backdrop-blur-md border border-gray-200/90 dark:border-surface-700 shadow-md text-gray-800 dark:text-gray-100 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-surface-700 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
        :class="[
          showArrows === 'hover' ? 'opacity-0 sm:group-hover/carousel:opacity-100' : 'opacity-100',
          { 'opacity-0 pointer-events-none': !canScrollLeft }
        ]"
        :disabled="!canScrollLeft"
        :aria-label="title ? `Scroll ${title} previous` : 'Scroll previous'"
        @click="scrollPrev"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      <!-- Left edge gradient fade -->
      <div
        v-if="showEdgeGradients"
        class="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-linear-to-r from-surface-50 dark:from-surface-950 to-transparent transition-opacity duration-300"
        :class="canScrollLeft ? 'opacity-100' : 'opacity-0'"
      ></div>

      <!-- Scrollable Track -->
      <div
        ref="carouselTrack"
        class="flex overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
        :class="[gapClass, contentClass]"
      >
        <slot />
      </div>

      <!-- Right edge gradient fade -->
      <div
        v-if="showEdgeGradients"
        class="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-linear-to-l from-surface-50 dark:from-surface-950 to-transparent transition-opacity duration-300"
        :class="canScrollRight ? 'opacity-100' : 'opacity-0'"
      ></div>

      <!-- Right Floating Navigation Arrow -->
      <button
        v-if="showArrows !== 'never'"
        type="button"
        class="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 dark:bg-surface-800/90 backdrop-blur-md border border-gray-200/90 dark:border-surface-700 shadow-md text-gray-800 dark:text-gray-100 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-surface-700 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
        :class="[
          showArrows === 'hover' ? 'opacity-0 sm:group-hover/carousel:opacity-100' : 'opacity-100',
          { 'opacity-0 pointer-events-none': !canScrollRight }
        ]"
        :disabled="!canScrollRight"
        :aria-label="title ? `Scroll ${title} next` : 'Scroll next'"
        @click="scrollNext"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  </section>
</template>
