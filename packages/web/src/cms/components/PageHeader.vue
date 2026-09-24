<script setup lang="ts">
defineProps<{ title: string; description?: string; count?: number | null }>()
</script>

<template>
  <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h1 class="truncate text-xl font-semibold text-gray-900 dark:text-white">{{ title }}</h1>
        <span
          v-if="count !== null && count !== undefined"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          {{ count }}
        </span>
      </div>
      <p v-if="description" class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
    </div>

    <div class="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
      <slot name="actions" />
    </div>
  </header>
</template>
