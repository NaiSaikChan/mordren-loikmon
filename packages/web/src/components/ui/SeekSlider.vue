<script setup lang="ts">
/**
 * Accessible scrubber for the player.
 *
 * Replaces a click-only `<div>`: this is a real `role="slider"` that can be
 * tabbed to, driven with the arrow keys, and dragged with a pointer. While
 * dragging, only the handle moves — the seek is committed on release, so audio
 * does not stutter through every intermediate position.
 */
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Position through the track, 0-100. */
    percent: number
    durationSeconds: number
    label: string
    /** Renders a position (in seconds) as speech for assistive tech. */
    valueText: (seconds: number) => string
    size?: 'thin' | 'thick'
    disabled?: boolean
  }>(),
  { size: 'thick', disabled: false },
)

const emit = defineEmits<{ seek: [percent: number] }>()

/** Arrow keys move by a fixed amount of audio, not a fixed fraction of the bar. */
const STEP_SECONDS = 5
const PAGE_SECONDS = 30

const dragPercent = ref<number | null>(null)
const dragging = computed(() => dragPercent.value !== null)
const shown = computed(() => Math.max(0, Math.min(100, dragPercent.value ?? props.percent)))
const shownSeconds = computed(() => (shown.value / 100) * props.durationSeconds)

function percentFromPointer(e: PointerEvent, el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  if (!rect.width) return props.percent
  return Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
}

function onPointerdown(e: PointerEvent) {
  if (props.disabled) return
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  dragPercent.value = percentFromPointer(e, el)
}

function onPointermove(e: PointerEvent) {
  if (!dragging.value) return
  dragPercent.value = percentFromPointer(e, e.currentTarget as HTMLElement)
}

function onPointerup(e: PointerEvent) {
  if (!dragging.value) return
  const value = percentFromPointer(e, e.currentTarget as HTMLElement)
  dragPercent.value = null
  emit('seek', value)
}

function nudge(seconds: number) {
  if (props.disabled || !props.durationSeconds) return
  const next = ((shownSeconds.value + seconds) / props.durationSeconds) * 100
  emit('seek', Math.max(0, Math.min(100, next)))
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      e.preventDefault()
      nudge(STEP_SECONDS)
      break
    case 'ArrowLeft':
    case 'ArrowDown':
      e.preventDefault()
      nudge(-STEP_SECONDS)
      break
    case 'PageUp':
      e.preventDefault()
      nudge(PAGE_SECONDS)
      break
    case 'PageDown':
      e.preventDefault()
      nudge(-PAGE_SECONDS)
      break
    case 'Home':
      e.preventDefault()
      emit('seek', 0)
      break
    case 'End':
      e.preventDefault()
      emit('seek', 100)
      break
    default:
      break
  }
}
</script>

<template>
  <div
    role="slider"
    :tabindex="disabled ? -1 : 0"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(shown)"
    :aria-valuetext="valueText(shownSeconds)"
    :aria-disabled="disabled || undefined"
    class="group relative flex w-full touch-none items-center rounded-full
           focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
    :class="[size === 'thin' ? 'h-1.5' : 'h-6', disabled ? 'cursor-default' : 'cursor-pointer']"
    @pointerdown="onPointerdown"
    @pointermove="onPointermove"
    @pointerup="onPointerup"
    @pointercancel="onPointerup"
    @keydown="onKeydown"
  >
    <div
      class="w-full overflow-hidden rounded-full bg-gray-200 dark:bg-surface-800"
      :class="size === 'thin' ? 'h-1' : 'h-1.5 group-hover:h-2.5 transition-[height] motion-reduce:transition-none'"
    >
      <div
        class="h-full rounded-full bg-audio-500"
        :class="dragging ? '' : 'transition-[width] duration-150 motion-reduce:transition-none'"
        :style="{ width: `${shown}%` }"
      />
    </div>
    <!-- Handle: always present for pointer targets, revealed on hover/focus/drag. -->
    <span
      v-if="size !== 'thin'"
      class="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full
             bg-audio-500 ring-2 ring-white transition-opacity dark:ring-surface-900
             motion-reduce:transition-none"
      :class="dragging ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'"
      :style="{ left: `${shown}%` }"
    />
  </div>
</template>
