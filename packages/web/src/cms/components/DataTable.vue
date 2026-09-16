<script setup lang="ts" generic="T extends { id: string | number }">
import { computed } from 'vue'

/**
 * The CMS table.
 *
 * - Header, body and every cell come from slots, so a page controls its own
 *   markup while keeping consistent spacing, selection and empty/loading states.
 * - On phones the table collapses to stacked cards: each cell carries its
 *   column label in `data-label`, shown by the CSS below under 640px.
 * - Long lists render at most `limit` rows; paging is handled by the caller.
 */
const props = withDefaults(
  defineProps<{
    rows: T[]
    columns: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center'; width?: string; hideOnMobile?: boolean }>
    loading?: boolean
    error?: string | null
    emptyTitle?: string
    emptyMessage?: string
    selectable?: boolean
    selection?: Set<string | number>
    allSelected?: boolean
    rowKey?: (row: T) => string | number
    /** Marks a row as inactive (archived, hidden) with reduced emphasis. */
    dimmed?: (row: T) => boolean
  }>(),
  {
    loading: false,
    error: null,
    emptyTitle: 'Nothing here yet',
    emptyMessage: 'Adjust the filters, or create the first record.',
    selectable: false,
    allSelected: false,
  },
)

const emit = defineEmits<{ toggle: [id: string | number]; toggleAll: []; retry: [] }>()

const keyOf = (row: T) => (props.rowKey ? props.rowKey(row) : row.id)
const columnCount = computed(() => props.columns.length + (props.selectable ? 1 : 0))
const alignClass = (align?: string) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left')
</script>

<template>
  <div class="cms-table-wrap overflow-x-auto rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-surface-900">
    <table class="w-full min-w-full text-sm">
      <thead class="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-surface-800/60 dark:text-gray-400">
        <tr>
          <th v-if="selectable" scope="col" class="w-10 px-3 py-2.5">
            <input
              type="checkbox"
              class="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              :checked="allSelected"
              :aria-label="allSelected ? 'Clear selection' : 'Select all rows on this page'"
              @change="emit('toggleAll')"
            />
          </th>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="px-3 py-2.5 font-semibold"
            :class="[alignClass(column.align), column.hideOnMobile ? 'hidden md:table-cell' : '']"
            :style="column.width ? { width: column.width } : undefined"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>

      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
        <!-- Loading: skeleton rows keep the layout from jumping -->
        <template v-if="loading && !rows.length">
          <tr v-for="n in 6" :key="`skeleton-${n}`">
            <td v-if="selectable" class="px-3 py-3"><div class="skeleton h-4 w-4" /></td>
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-3 py-3"
              :class="column.hideOnMobile ? 'hidden md:table-cell' : ''"
            >
              <div class="skeleton h-4" :style="{ width: `${40 + ((n * 13) % 50)}%` }" />
            </td>
          </tr>
        </template>

        <tr v-else-if="error">
          <td :colspan="columnCount" class="px-4 py-10 text-center">
            <p class="text-sm font-medium text-red-600 dark:text-red-400">{{ error }}</p>
            <button type="button" class="btn-secondary mt-3" @click="emit('retry')">Try again</button>
          </td>
        </tr>

        <tr v-else-if="!rows.length">
          <td :colspan="columnCount" class="px-4 py-12 text-center">
            <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ emptyTitle }}</p>
            <p class="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{{ emptyMessage }}</p>
            <div class="mt-4"><slot name="empty-action" /></div>
          </td>
        </tr>

        <template v-else>
          <tr
            v-for="row in rows"
            :key="keyOf(row)"
            class="transition-colors hover:bg-gray-50 dark:hover:bg-surface-800/60"
            :class="dimmed?.(row) ? 'opacity-60' : ''"
          >
            <td v-if="selectable" class="px-3 py-2.5 align-middle">
              <input
                type="checkbox"
                class="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                :checked="selection?.has(keyOf(row))"
                :aria-label="`Select row ${keyOf(row)}`"
                @change="emit('toggle', keyOf(row))"
              />
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-3 py-2.5 align-middle"
              :class="[alignClass(column.align), column.hideOnMobile ? 'hidden md:table-cell' : '']"
              :data-label="column.label"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="(row as Record<string, unknown>)[column.key]">
                {{ (row as Record<string, unknown>)[column.key] ?? '—' }}
              </slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <!-- A refresh over existing rows: a thin bar rather than a full skeleton -->
    <div v-if="loading && rows.length" class="h-0.5 w-full overflow-hidden bg-brand-100 dark:bg-brand-900/40">
      <div class="h-full w-1/3 animate-[cms-progress_1.1s_ease-in-out_infinite] bg-brand-500" />
    </div>
  </div>
</template>

<style scoped>
@keyframes cms-progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

/* Phone layout: each row becomes a card, each cell shows its column label. */
@media (max-width: 639px) {
  .cms-table-wrap { overflow-x: visible; }
  .cms-table-wrap table,
  .cms-table-wrap tbody,
  .cms-table-wrap tr,
  .cms-table-wrap td { display: block; width: 100%; }
  .cms-table-wrap thead { display: none; }
  .cms-table-wrap tr { padding: 0.5rem 0.25rem; }
  .cms-table-wrap td {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    justify-content: space-between;
    text-align: right;
  }
  .cms-table-wrap td[data-label]::before {
    content: attr(data-label);
    flex: 0 0 auto;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.6;
    text-align: left;
  }
}
</style>
