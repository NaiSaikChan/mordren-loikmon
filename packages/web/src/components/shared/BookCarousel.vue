<script setup lang="ts">
import type { Book } from '@loikmon/api'
import ScrollCarousel from './ScrollCarousel.vue'
import BookCard from './BookCard.vue'

export interface BookCarouselProps {
  books: Book[]
  title?: string
  cardWidthClass?: string
  showArrows?: 'always' | 'hover' | 'never'
  scrollRatio?: number
  autoPlay?: boolean
  autoPlayInterval?: number
  loop?: boolean
}

withDefaults(defineProps<BookCarouselProps>(), {
  title: undefined,
  cardWidthClass: 'w-[155px] sm:w-[180px] md:w-[195px] lg:w-[205px]',
  showArrows: 'hover',
  scrollRatio: 0.8,
  autoPlay: false,
  autoPlayInterval: 5000,
  loop: false,
})
</script>

<template>
  <ScrollCarousel
    v-if="books && books.length"
    :title="title"
    :show-arrows="showArrows"
    :scroll-ratio="scrollRatio"
    :auto-play="autoPlay"
    :auto-play-interval="autoPlayInterval"
    :loop="loop"
  >
    <template #header>
      <slot name="header" />
    </template>
    <template #title>
      <slot name="title" />
    </template>
    <template #actions>
      <slot name="actions" />
    </template>

    <div
      v-for="b in books"
      :key="b.id"
      class="snap-start shrink-0 transition-transform duration-300 hover:-translate-y-1.5"
      :class="cardWidthClass"
    >
      <slot name="item" :book="b">
        <BookCard :book="b" />
      </slot>
    </div>
  </ScrollCarousel>
</template>
