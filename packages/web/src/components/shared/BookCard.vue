<script setup lang="ts">
import { computed } from 'vue'
import type { Book } from '@loikmon/api'
import AccessBadge from './AccessBadge.vue'

const props = defineProps<{ book: Book }>()

const cover = computed(() => props.book.thumbnail ?? props.book.cover_url ?? props.book.coverphoto ?? '')
const rating = computed(() => Number(props.book.rating ?? 0))
</script>

<template>
  <RouterLink :to="`/books/${book.id}`" class="group block">
    <div class="card overflow-hidden">
      <div class="aspect-[3/4] bg-gray-100 dark:bg-surface-800 overflow-hidden relative">
        <img
          v-if="cover"
          :src="cover"
          :alt="book.title"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          @error="($event.target as HTMLImageElement).style.display='none'"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-4xl">📚</div>
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
