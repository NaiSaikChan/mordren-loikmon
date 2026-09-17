<script setup lang="ts">
import type { Author } from '@loikmon/api'
import { computed } from 'vue'
import ResponsiveImg from './ResponsiveImg.vue'

const props = defineProps<{ author: Author }>()

const avatarUrl = computed(() => props.author.thumbnail ?? props.author.avatar_url ?? '')
const booksCount = computed(() => Number(props.author.bookscount ?? props.author.books_count ?? 0))
const articlesCount = computed(() => Number(props.author.articlescount ?? props.author.articles_count ?? 0))
</script>

<template>
  <RouterLink :to="`/authors/${author.id}`" class="group block">
    <div class="card overflow-hidden">
      <!-- Thumbnail -->
      <div class="w-full aspect-square overflow-hidden bg-gray-200 dark:bg-surface-700 relative">
        <!-- Square card thumbnail (no assetType: the card keeps its square frame rather than the avatar circle). -->
        <ResponsiveImg
          :image="author.avatar_image"
          :fallback="avatarUrl"
          :alt="author.name"
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
          img-class="group-hover:scale-105 transition-transform duration-300"
        >
          <template #empty>
            <div class="w-full h-full flex items-center justify-center bg-linear-to-br from-brand-100 to-brand-200 dark:from-brand-900/50 dark:to-brand-800/50">
              <span class="text-6xl text-brand-600 dark:text-brand-400">{{ author.name.charAt(0) }}</span>
            </div>
          </template>
        </ResponsiveImg>
      </div>
      
      <!-- Info -->
      <div class="p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white truncate mb-3 pt-1">
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
