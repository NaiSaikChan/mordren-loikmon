<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    /** Percentage change against the previous period; sign decides the colour. */
    delta?: number | null
    /** Sparkline values, newest last. */
    series?: number[]
    loading?: boolean
  }>(),
  { delta: null, loading: false },
)

const deltaTone = computed(() =>
  props.delta === null || props.delta === 0
    ? 'text-gray-500 dark:text-gray-400'
    : props.delta > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400',
)

/** Sparkline path normalised into a 100x28 box. */
const sparkline = computed(() => {
  const values = props.series ?? []
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      const y = 28 - ((value - min) / span) * 26 - 1
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
})
</script>

<template>
  <div class="card p-4">
    <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ label }}</p>

    <div v-if="loading" class="mt-2 space-y-2">
      <div class="skeleton h-7 w-24" />
      <div class="skeleton h-3 w-16" />
    </div>

    <template v-else>
      <p class="mt-1 text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">{{ value }}</p>
      <div class="mt-1 flex items-end justify-between gap-3">
        <p class="text-xs" :class="deltaTone">
          <template v-if="delta !== null">{{ delta > 0 ? '▲' : delta < 0 ? '▼' : '■' }} {{ Math.abs(delta) }}%</template>
          <span v-if="hint" class="text-gray-500 dark:text-gray-400">{{ delta !== null ? ' · ' : '' }}{{ hint }}</span>
        </p>
        <svg
          v-if="sparkline"
          class="h-7 w-24 shrink-0 text-brand-500"
          viewBox="0 0 100 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path :d="sparkline" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
    </template>
  </div>
</template>
