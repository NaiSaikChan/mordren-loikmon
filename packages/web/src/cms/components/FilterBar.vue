<script setup lang="ts">
import { computed } from 'vue'

/**
 * Search box plus a row of filter controls, with a "clear" action that appears
 * only when something is actually filtered.
 */
const props = withDefaults(
  defineProps<{ search?: string; placeholder?: string; active?: boolean; selectedCount?: number }>(),
  { placeholder: 'Search…', active: false, selectedCount: 0 },
)

const emit = defineEmits<{ 'update:search': [value: string]; clear: [] }>()

const hasSelection = computed(() => props.selectedCount > 0)
</script>

<template>
  <div class="mb-4 space-y-3 print:hidden">
    <div class="flex flex-wrap items-center gap-2">
      <div v-if="search !== undefined" class="relative min-w-52 flex-1">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" aria-hidden="true">🔍</span>
        <input
          type="search"
          class="input h-9 pl-9"
          :value="search"
          :placeholder="placeholder"
          :aria-label="placeholder"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <slot name="filters" />

      <button v-if="active" type="button" class="btn-ghost h-9 px-3 text-xs" @click="emit('clear')">Clear filters</button>
    </div>

    <!-- Bulk action bar: only present once rows are selected -->
    <div
      v-if="hasSelection"
      class="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm dark:border-brand-900/50 dark:bg-brand-900/20"
    >
      <span class="font-medium text-brand-800 dark:text-brand-200">{{ selectedCount }} selected</span>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <slot name="bulk" />
      </div>
    </div>
  </div>
</template>
