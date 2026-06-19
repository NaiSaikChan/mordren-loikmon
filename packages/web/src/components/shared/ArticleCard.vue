<script setup lang="ts">
import type { Article } from '@loikmon/api'
defineProps<{ article: Article }>()
</script>

<template>
  <RouterLink :to="`/articles/${article.id}`" class="group block">
    <div class="card overflow-hidden flex gap-3 p-3">
      <div v-if="article.thumbnail_url || article.thumbnail" class="w-20 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-surface-800">
        <img :src="article.thumbnail_url ?? article.thumbnail" :alt="article.title" class="w-full h-full object-cover" loading="lazy" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {{ article.title }}
        </h3>
        <p class="mt-1 text-xs text-gray-400">{{ article.author }}</p>
        <div class="mt-1.5">
          <span v-if="article.is_free" class="badge-green">Free</span>
          <span v-else-if="article.price" class="text-xs text-brand-600 dark:text-brand-400 font-semibold">{{ article.price }} coins</span>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
