<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * Time-series chart drawn as inline SVG — no charting dependency.
 *
 * The series is rendered in a fixed 0..100 x 0..100 viewBox and stretched by
 * CSS, so it is responsive without measuring the DOM. Hovering highlights the
 * nearest point; the same data is also exposed as a table for screen readers.
 */
const props = withDefaults(
  defineProps<{
    points: Array<{ date: string; value: number }>
    label: string
    /** Formats the value in the tooltip and on the axis. */
    format?: (value: number) => string
    height?: number
    area?: boolean
  }>(),
  { height: 180, area: true },
)

const hover = ref<number | null>(null)
const fmt = (value: number) => (props.format ? props.format(value) : String(value))

const max = computed(() => Math.max(1, ...props.points.map((p) => p.value)))
const coords = computed(() =>
  props.points.map((point, index) => ({
    ...point,
    x: props.points.length === 1 ? 50 : (index / (props.points.length - 1)) * 100,
    y: 100 - (point.value / max.value) * 92 - 4,
  })),
)

const linePath = computed(() => coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' '))
const areaPath = computed(() => (coords.value.length ? `${linePath.value} L100,100 L0,100 Z` : ''))

const active = computed(() => (hover.value === null ? null : coords.value[hover.value]))

function onMove(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (!rect.width || !coords.value.length) return
  const ratio = (event.clientX - rect.left) / rect.width
  hover.value = Math.min(coords.value.length - 1, Math.max(0, Math.round(ratio * (coords.value.length - 1))))
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
</script>

<template>
  <figure class="relative">
    <figcaption class="sr-only">{{ label }}</figcaption>

    <div
      class="relative"
      :style="{ height: `${height}px` }"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <svg class="h-full w-full text-brand-500" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <!-- Horizontal guides at 0 / 50 / 100% of the maximum -->
        <line v-for="y in [4, 50, 96]" :key="y" x1="0" :y1="y" x2="100" :y2="y" class="stroke-gray-200 dark:stroke-gray-700" stroke-width="0.4" vector-effect="non-scaling-stroke" />

        <path v-if="area && areaPath" :d="areaPath" fill="currentColor" opacity="0.12" />
        <path v-if="linePath" :d="linePath" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />

        <g v-if="active">
          <line :x1="active.x" y1="0" :x2="active.x" y2="100" class="stroke-gray-300 dark:stroke-gray-600" stroke-width="0.6" vector-effect="non-scaling-stroke" />
          <circle :cx="active.x" :cy="active.y" r="3" fill="currentColor" vector-effect="non-scaling-stroke" />
        </g>
      </svg>

      <div
        v-if="active"
        class="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg bg-gray-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        :style="{ left: `${Math.min(88, Math.max(12, active.x))}%` }"
      >
        <span class="font-semibold">{{ fmt(active.value) }}</span>
        <span class="opacity-70"> · {{ shortDate(active.date) }}</span>
      </div>

      <p v-if="!points.length" class="absolute inset-0 grid place-items-center text-sm text-gray-400">No data in this period</p>
    </div>

    <div v-if="points.length > 1" class="mt-1 flex justify-between text-[11px] text-gray-400">
      <span>{{ shortDate(points[0].date) }}</span>
      <span>{{ shortDate(points[points.length - 1].date) }}</span>
    </div>

    <!-- Same numbers, reachable without sight of the chart -->
    <table class="sr-only">
      <caption>{{ label }}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Value</th></tr></thead>
      <tbody>
        <tr v-for="point in points" :key="point.date"><td>{{ point.date }}</td><td>{{ fmt(point.value) }}</td></tr>
      </tbody>
    </table>
  </figure>
</template>
