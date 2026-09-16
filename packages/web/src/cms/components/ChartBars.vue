<script setup lang="ts">
import { computed } from 'vue'

/**
 * Horizontal bar chart for categorical breakdowns (status counts, ratings,
 * top campaigns). Built from divs so labels wrap and stay readable on a phone.
 */
const props = withDefaults(
  defineProps<{
    items: Array<{ label: string; value: number; hint?: string }>
    format?: (value: number) => string
    /** Colour the bar by index rather than using the brand colour throughout. */
    palette?: boolean
    emptyMessage?: string
  }>(),
  { palette: false, emptyMessage: 'Nothing to show yet' },
)

const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
const fmt = (value: number) => (props.format ? props.format(value) : new Intl.NumberFormat('en-US').format(value))

// Ordered so neighbouring bars stay distinguishable in both themes.
const COLORS = ['bg-brand-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500']
</script>

<template>
  <div>
    <p v-if="!items.length" class="py-6 text-center text-sm text-gray-400">{{ emptyMessage }}</p>

    <ul v-else class="space-y-2.5">
      <li v-for="(item, index) in items" :key="`${item.label}-${index}`">
        <div class="mb-1 flex items-baseline justify-between gap-3 text-xs">
          <span class="truncate font-medium text-gray-700 dark:text-gray-200">{{ item.label }}</span>
          <span class="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
            {{ fmt(item.value) }}<template v-if="item.hint"> · {{ item.hint }}</template>
          </span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            class="h-full rounded-full transition-[width] duration-500"
            :class="palette ? COLORS[index % COLORS.length] : 'bg-brand-500'"
            :style="{ width: `${Math.max(2, (item.value / max) * 100)}%` }"
            role="img"
            :aria-label="`${item.label}: ${fmt(item.value)}`"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
