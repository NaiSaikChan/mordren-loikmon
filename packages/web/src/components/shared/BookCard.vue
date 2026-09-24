<script setup lang="ts">
import { computed } from 'vue'
import type { Book } from '@loikmon/api'
import AccessBadge from './AccessBadge.vue'
import ResponsiveImg from './ResponsiveImg.vue'

const props = defineProps<{ book: Book }>()

const cover = computed(() => props.book.thumbnail ?? props.book.cover_url ?? props.book.coverphoto ?? '')
// Matches `.content-grid` (2/3/4/5 columns inside max-w-screen-xl) and the carousel card widths.
const COVER_SIZES = '(min-width: 1024px) 240px, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw'
const rating = computed(() => Number(props.book.rating ?? 0))
</script>

<template>
  <RouterLink :to="`/books/${book.id}`" class="group block">
    <div class="card overflow-hidden">
      <div class="aspect-[3/4] bg-gray-100 dark:bg-surface-800 overflow-hidden relative">
        <ResponsiveImg
          :image="book.cover_image"
          :fallback="cover"
          :alt="book.title"
          asset-type="book_cover"
          fill
          :sizes="COVER_SIZES"
          img-class="transition-transform duration-300 group-hover:scale-105"
        >
          <template #empty><span class="text-4xl">📚</span></template>
        </ResponsiveImg>
        <span
          v-if="book.has_audio"
          class="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
          aria-hidden="true"
        >🎧</span>
      </div>
      <div class="p-3">
        <h3 class="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1.5 pt-1">
          {{ book.title }}
        </h3>
        <p v-if="book.authorname" class="text-xs text-gray-400 truncate leading-tight mb-3 pt-1">{{ book.authorname }}</p>
        <div class="flex items-center justify-between gap-1 pt-1">
          <AccessBadge :item="book" />
          <div v-if="rating > 0" class="flex items-center gap-0.5 text-xs text-yellow-500 shrink-0">
            ⭐ {{ rating.toFixed(1) }}
          </div>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
