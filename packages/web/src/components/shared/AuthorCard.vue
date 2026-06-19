<script setup lang="ts">
import type { Author } from '@loikmon/api'
defineProps<{ author: Author }>()
</script>

<template>
  <RouterLink :to="`/authors/${author.id}`" class="group block">
    <div class="card p-4 text-center">
      <div class="w-16 h-16 rounded-full overflow-hidden bg-brand-100 dark:bg-brand-900/30 mx-auto mb-3 flex items-center justify-center">
        <img v-if="author.avatar_url ?? author.avatar" :src="author.avatar_url ?? author.avatar" :alt="author.name" class="w-full h-full object-cover" />
        <span v-else class="text-2xl text-brand-600 dark:text-brand-400 font-bold">{{ author.name.charAt(0) }}</span>
      </div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
        {{ author.name }}
      </h3>
      <p class="text-xs text-gray-400 mt-0.5">{{ author.books_count ?? 0 }} books</p>
    </div>
  </RouterLink>
</template>
