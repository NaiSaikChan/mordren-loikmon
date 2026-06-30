<script setup lang="ts">
import type { Author } from '@loikmon/api'
import { computed } from 'vue'

const props = defineProps<{ author: Author }>()

const avatarUrl = computed(() => (props.author.thumbnail ?? props.author.avatar_url ?? props.author.avatar ?? '') as string)
const booksCount = computed(() => Number(props.author.bookscount ?? props.author.books_count ?? 0))
const articlesCount = computed(() => Number(props.author.articlescount ?? props.author.articles_count ?? 0))
</script>

<template>
  <RouterLink :to="`/authors/${author.id}`" class="group block">
    <div class="card overflow-hidden">
      <!-- Thumbnail -->
      <div class="w-full aspect-square overflow-hidden bg-gray-200 dark:bg-surface-700 relative">
        <img v-if="avatarUrl" :src="avatarUrl" :alt="author.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div v-else class="w-full h-full flex items-center justify-center bg-linear-to-br from-brand-100 to-brand-200 dark:from-brand-900/50 dark:to-brand-800/50">
          <span class="text-6xl text-brand-600 dark:text-brand-400">{{ author.name.charAt(0) }}</span>
        </div>
      </div>
      
      <!-- Info -->
      <div class="p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white truncate mb-3">
          {{ author.name }}
        </h3>
        <div class="flex gap-3 text-xs">
          <span v-if="booksCount > 0" class="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <span>📚</span>
            <span>{{ booksCount }}</span>
          </span>
          <span v-if="articlesCount > 0" class="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <span>📰</span>
            <span>{{ articlesCount }}</span>
          </span>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
