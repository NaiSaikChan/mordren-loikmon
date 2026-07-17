<script setup lang="ts">
defineProps<{
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
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-4 mt-6">

    <!-- Page size selector -->
    <!-- <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <span>Rows per page:</span>
      <select
        :value="pageSize"
        class="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
        @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="size in pageSizes" :key="size" :value="size" :selected="size === pageSize">{{ size }}</option>
      </select>
    </div> -->

    <!-- Page navigation -->
    <div class="flex items-center gap-3">
      <button
        class="btn-secondary"
        :disabled="page <= 1 || loading"
        @click="emit('update:page', page - 1)"
      >
        ← Prev
      </button>

      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 select-none min-w-24 text-center">
        <template v-if="totalPages > 0">Page {{ page }} of {{ totalPages }}</template>
        <template v-else>Page {{ page }}</template>
      </span>

      <button
        class="btn-secondary"
        :disabled="isLastPage || loading"
        @click="emit('update:page', page + 1)"
      >
        Next →
      </button>
    </div>

  </div>
</template>
