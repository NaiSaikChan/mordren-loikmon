<script setup lang="ts">
import { computed } from 'vue'
import type { Book } from '@loikmon/api'

const props = defineProps<{ book: Book }>()

function fixUrl(url: string): string {
  if (!url) return ''
  let u = url.replace(/\\/g, '/')
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
  return u
}

const cover = computed(() => {
  const b = props.book
  return fixUrl(b.thumbnail ?? b.coverphoto ?? b.cover_url ?? b.cover ?? '')
})

const authorDisplay = computed(() =>
  props.book.authorname ?? props.book.author ?? ''
)
const isFree = computed(() => {
  const p = props.book.amount ?? props.book.price
  return props.book.is_free || !p || Number(p) === 0
})
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
          @error="($event.target as HTMLImageElement).style.display='none'"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-4xl">📚</div>
      </div>
      <div class="p-2.5">
        <h3 class="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1">
          {{ book.title }}
        </h3>
        <p v-if="authorDisplay" class="text-xs text-gray-400 truncate">{{ authorDisplay }}</p>
        <div class="mt-1.5 flex items-center justify-between">
          <span v-if="isFree" class="badge-green">Free</span>
          <span v-else class="text-xs font-semibold text-brand-600 dark:text-brand-400">
            {{ book.amount ?? book.price }} coins
          </span>
          <div v-if="book.rating" class="flex items-center gap-0.5 text-xs text-yellow-500">
            ⭐ {{ Number(book.rating).toFixed(1) }}
          </div>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
