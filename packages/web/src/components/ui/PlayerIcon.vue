<script setup lang="ts">
/**
 * Inline SVG icon set for the player.
 *
 * Deliberately hand-rolled rather than an icon dependency: this is the only
 * place the app needs icons today, and emoji (which these replace) render
 * differently per platform and are announced as "play button emoji" by screen
 * readers. Always decorative — the accessible name lives on the button.
 */
import { computed } from 'vue'

export type PlayerIconName =
  | 'play' | 'pause' | 'skip-back' | 'skip-forward' | 'previous' | 'next'
  | 'close' | 'chevron-up' | 'chevron-down' | 'lock' | 'speed' | 'moon'
  | 'headphones' | 'list' | 'alert' | 'restart'

const props = withDefaults(defineProps<{ name: PlayerIconName; size?: number | string }>(), {
  size: 20,
})

/** Icons drawn with fills read better at small sizes than hairline strokes. */
const FILLED: Partial<Record<PlayerIconName, string>> = {
  play: 'M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z',
  pause: 'M7 4h3.2v16H7zM13.8 4H17v16h-3.2z',
  previous: 'M19 5.5v13a1 1 0 0 1-1.55.83L8 13v5.5a1 1 0 0 1-2 0v-13a1 1 0 0 1 2 0V11l9.45-6.33A1 1 0 0 1 19 5.5Z',
  next: 'M5 5.5v13a1 1 0 0 0 1.55.83L16 13v5.5a1 1 0 0 0 2 0v-13a1 1 0 0 0-2 0V11L6.55 4.67A1 1 0 0 0 5 5.5Z',
}

const STROKED: Partial<Record<PlayerIconName, string[]>> = {
  'skip-back': ['M11.5 4.5 6 10l5.5 5.5', 'M6 10h7a5 5 0 0 1 0 10H9'],
  'skip-forward': ['M12.5 4.5 18 10l-5.5 5.5', 'M18 10h-7a5 5 0 0 0 0 10h4'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  'chevron-up': ['m6 15 6-6 6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  lock: ['M7 11V8a5 5 0 0 1 10 0v3', 'M5.5 11h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z'],
  speed: ['M12 20a8 8 0 1 1 8-8', 'M12 12l4.5-3.5'],
  moon: ['M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z'],
  headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2Z', 'M20 15a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2Z'],
  list: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  alert: ['M12 8v5', 'M12 16.5v.5', 'M12 3.5 2.5 20h19Z'],
  restart: ['M4 10a8 8 0 1 1 1.6 6', 'M4 5v5h5'],
}

const filled = computed(() => FILLED[props.name])
const strokes = computed(() => STROKED[props.name] ?? [])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    class="shrink-0"
  >
    <path v-if="filled" :d="filled" fill="currentColor" />
    <g
      v-else
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path v-for="(d, i) in strokes" :key="i" :d="d" />
    </g>
  </svg>
</template>
