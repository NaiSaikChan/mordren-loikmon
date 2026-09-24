<script setup lang="ts">
import { computed } from 'vue'

/** Donut for a small set of parts of a whole (content by status, plan mix). */
const props = withDefaults(
  defineProps<{ items: Array<{ label: string; value: number }>; total?: number | null; centerLabel?: string }>(),
  { total: null },
)

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6']
const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const sum = computed(() => props.total ?? props.items.reduce((acc, i) => acc + i.value, 0))

/** Each slice as a dash offset on one circle — no path maths needed. */
const slices = computed(() => {
  let offset = 0
  return props.items
    .filter((item) => item.value > 0)
    .map((item, index) => {
      const fraction = sum.value ? item.value / sum.value : 0
      const slice = {
        ...item,
        color: COLORS[index % COLORS.length],
        dash: fraction * CIRCUMFERENCE,
        offset: -offset * CIRCUMFERENCE,
        percent: Math.round(fraction * 1000) / 10,
      }
      offset += fraction
      return slice
    })
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 sm:flex-row">
    <div class="relative shrink-0">
      <svg width="132" height="132" viewBox="0 0 100 100" role="img" :aria-label="centerLabel ?? 'Distribution'">
        <circle cx="50" cy="50" :r="RADIUS" fill="none" class="stroke-gray-100 dark:stroke-gray-800" stroke-width="14" />
        <circle
          v-for="slice in slices"
          :key="slice.label"
          cx="50"
          cy="50"
          :r="RADIUS"
          fill="none"
          :stroke="slice.color"
          stroke-width="14"
          :stroke-dasharray="`${slice.dash} ${CIRCUMFERENCE - slice.dash}`"
          :stroke-dashoffset="slice.offset"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div class="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <span class="text-xl font-semibold text-gray-900 dark:text-white">{{ sum }}</span>
        <span v-if="centerLabel" class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ centerLabel }}</span>
      </div>
    </div>

    <ul class="w-full min-w-0 flex-1 space-y-1.5 text-sm">
      <li v-for="slice in slices" :key="slice.label" class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: slice.color }" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate capitalize text-gray-600 dark:text-gray-300">{{ slice.label.replace(/_/g, ' ') }}</span>
        <span class="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">{{ slice.value }} · {{ slice.percent }}%</span>
      </li>
      <li v-if="!slices.length" class="py-4 text-center text-gray-400">No data</li>
    </ul>
  </div>
</template>
