<script setup lang="ts">
import { computed } from 'vue'
import type { Pagination } from '@loikmon/api'

const props = defineProps<{ pagination: Pagination | null; limit: number; loading?: boolean }>()
const emit = defineEmits<{ 'update:page': [page: number]; 'update:limit': [limit: number] }>()

const page = computed(() => props.pagination?.page ?? 1)
const totalPages = computed(() => props.pagination?.total_pages ?? 1)
const total = computed(() => props.pagination?.total ?? 0)

const from = computed(() => (total.value === 0 ? 0 : (page.value - 1) * props.limit + 1))
const to = computed(() => Math.min(page.value * props.limit, total.value))

/** Page numbers around the current one, with gaps marked as `null`. */
const pages = computed<Array<number | null>>(() => {
  const last = totalPages.value
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const around = [1, 2, page.value - 1, page.value, page.value + 1, last - 1, last]
  const keep = [...new Set(around.filter((n) => n >= 1 && n <= last))].sort((a, b) => a - b)
  const out: Array<number | null> = []
  let previous = 0
  for (const n of keep) {
    if (previous && n - previous > 1) out.push(null)
    out.push(n)
    previous = n
  }
  return out
})
</script>

<template>
  <nav
    v-if="pagination"
    class="flex flex-col gap-3 px-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between print:hidden"
    aria-label="Pagination"
  >
    <p class="text-gray-500 dark:text-gray-400">
      <template v-if="total">Showing <strong class="font-medium text-gray-700 dark:text-gray-200">{{ from }}–{{ to }}</strong> of {{ total }}</template>
      <template v-else>No results</template>
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <span class="sr-only sm:not-sr-only">Rows</span>
        <select
          class="input h-8 w-auto py-0 text-xs"
          :value="limit"
          @change="emit('update:limit', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in [10, 20, 50, 100]" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="btn-ghost h-8 px-2 text-xs"
          :disabled="page <= 1 || loading"
          aria-label="Previous page"
          @click="emit('update:page', page - 1)"
        >
          ‹
        </button>

        <template v-for="(entry, index) in pages" :key="`${entry}-${index}`">
          <span v-if="entry === null" class="px-1 text-gray-400" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            class="h-8 min-w-8 rounded-lg px-2 text-xs font-medium transition-colors"
            :class="
              entry === page
                ? 'bg-brand-600 text-white dark:bg-brand-500'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            "
            :aria-current="entry === page ? 'page' : undefined"
            :disabled="loading"
            @click="emit('update:page', entry)"
          >
            {{ entry }}
          </button>
        </template>

        <button
          type="button"
          class="btn-ghost h-8 px-2 text-xs"
          :disabled="page >= totalPages || loading"
          aria-label="Next page"
          @click="emit('update:page', page + 1)"
        >
          ›
        </button>
      </div>
    </div>
  </nav>
</template>
