<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  pageSize?: number
  isLastPage: boolean
  totalPages: number
  loading: boolean
  pageSizes?: number[]
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()

// Compute page numbers to display
const pageNumbers = computed(() => {
  const pages: (number | string)[] = []
  const maxPages = Math.min(5, props.totalPages) // Show max 5 page buttons
  const halfWindow = Math.floor(maxPages / 2)

  if (props.totalPages <= maxPages) {
    // Show all pages if total is small
    for (let i = 1; i <= props.totalPages; i++) {
      pages.push(i)
    }
  } else {
    // Calculate range around current page
    let start = Math.max(1, props.page - halfWindow)
    let end = Math.min(props.totalPages, start + maxPages - 1)

    if (end - start < maxPages - 1) {
      start = Math.max(1, end - maxPages + 1)
    }

    // Add first page if not in range
    if (start > 1) {
      pages.push(1)
      if (start > 2) {
        pages.push('...')
      }
    }

    // Add page range
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    // Add last page if not in range
    if (end < props.totalPages) {
      if (end < props.totalPages - 1) {
        pages.push('...')
      }
      pages.push(props.totalPages)
    }
  }

  return pages
})
</script>

<template>
  <nav class="flex items-center justify-center gap-2 mt-6">
    <!-- Previous Button -->
    <button
      type="button"
      class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
      :disabled="page <= 1 || loading"
      @click="emit('update:page', page - 1)"
    >
      ← Previous
    </button>

    <!-- Page Numbers -->
    <div class="flex items-center gap-1">
      <button
        v-for="pageNum in pageNumbers"
        :key="`page-${pageNum}`"
        type="button"
        :disabled="loading || pageNum === '...'"
        :aria-current="pageNum === page ? 'page' : undefined"
        class="px-2.5 py-1.5 rounded text-sm font-medium transition-colors"
        :class="[
          pageNum === page
            ? 'bg-brand-600 text-white'
            : pageNum === '...'
            ? 'cursor-default text-gray-600 dark:text-gray-400 hover:bg-transparent dark:hover:bg-transparent'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-800'
        ]"
        @click="typeof pageNum === 'number' && emit('update:page', pageNum)"
      >
        {{ pageNum }}
      </button>
    </div>

    <!-- Next Button -->
    <button
      type="button"
      class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
      :disabled="isLastPage || loading"
      @click="emit('update:page', page + 1)"
    >
      Next →
    </button>
  </nav>
</template>
