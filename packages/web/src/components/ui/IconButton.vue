<script setup lang="ts">
/**
 * Icon-only button.
 *
 * An icon alone has no accessible name, so `label` is required and becomes the
 * `aria-label` plus the hover tooltip. Every size keeps a 44px hit area on
 * touch, even when the visual circle is smaller.
 */
import PlayerIcon, { type PlayerIconName } from '@/components/ui/PlayerIcon.vue'

withDefaults(
  defineProps<{
    icon: PlayerIconName
    label: string
    size?: 'sm' | 'md' | 'lg'
    variant?: 'ghost' | 'solid' | 'accent'
    disabled?: boolean
    pressed?: boolean
  }>(),
  { size: 'md', variant: 'ghost', disabled: false, pressed: undefined },
)

const SIZES = {
  sm: { box: 'w-9 h-9', icon: 16 },
  md: { box: 'w-11 h-11', icon: 20 },
  lg: { box: 'w-14 h-14', icon: 26 },
} as const

const VARIANTS = {
  ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-800',
  solid: 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-500/25',
  accent: 'bg-audio-500 text-white hover:bg-audio-400 shadow-lg shadow-audio-500/25',
} as const
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    :aria-pressed="pressed"
    :disabled="disabled"
    class="relative inline-flex items-center justify-center rounded-full transition-colors cursor-pointer
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500
           disabled:opacity-40 disabled:cursor-not-allowed
           after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2
           after:w-11 after:h-11 after:content-['']"
    :class="[SIZES[size].box, VARIANTS[variant]]"
  >
    <PlayerIcon :name="icon" :size="SIZES[size].icon" />
  </button>
</template>
