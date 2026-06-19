<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center px-4">
    <div class="text-5xl mb-4">{{ icon ?? '📭' }}</div>
    <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">{{ title }}</h3>
    <p v-if="description" class="mt-1 text-sm text-gray-400 max-w-xs">{{ description }}</p>
    <slot />
  </div>
</template>
