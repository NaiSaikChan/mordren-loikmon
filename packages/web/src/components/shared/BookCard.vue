<script setup lang="ts">
import { computed } from 'vue'
import type { Book } from '@loikmon/api'

const props = defineProps<{ book: Book }>()
const cover = computed(() => props.book.cover_url ?? props.book.cover ?? '/placeholder-book.svg')
</script>

<template>
  <RouterLink :to="`/books/${book.id}`" class="group block">
    <div class="card overflow-hidden">
      <div class="aspect-[3/4] bg-gray-100 dark:bg-surface-800 overflow-hidden">
        <img
          :src="cover"
          :alt="book.title"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div class="p-2.5">
        <h3 class="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1">
          {{ book.title }}
        </h3>
        <p class="text-xs text-gray-400 truncate">{{ book.author }}</p>
        <div class="mt-1.5 flex items-center justify-between">
          <span v-if="book.is_free" class="badge-green">Free</span>
          <span v-else-if="book.price" class="text-xs font-semibold text-brand-600 dark:text-brand-400">
            {{ book.price }} coins
          </span>
          <div v-if="book.rating" class="flex items-center gap-0.5 text-xs text-yellow-500">
            ⭐ {{ Number(book.rating).toFixed(1) }}
          </div>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
