<script setup lang="ts">
/**
 * Small single-choice popover menu (playback speed, sleep timer).
 *
 * Exposed as a `menu` of `menuitemradio`s so assistive tech announces both the
 * options and which one is active. Closes on Escape, on outside click, and after
 * a choice — returning focus to the trigger each time.
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import PlayerIcon, { type PlayerIconName } from '@/components/ui/PlayerIcon.vue'

export interface MenuOption<T = unknown> {
  value: T
  label: string
}

const props = defineProps<{
  label: string
  icon: PlayerIconName
  /** Short text shown beside the icon, e.g. "1.5×" or "30m". */
  triggerText?: string
  options: MenuOption[]
  selected: unknown
  /** Highlights the trigger when the feature is on. */
  active?: boolean
}>()

const emit = defineEmits<{ select: [value: unknown] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)

function close(focusTrigger = true) {
  if (!open.value) return
  open.value = false
  if (focusTrigger) void nextTick(() => trigger.value?.focus())
}

function onDocumentPointerdown(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close(false)
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onDocumentPointerdown)
    document.addEventListener('keydown', onDocumentKeydown)
    void nextTick(() => menu.value?.querySelector<HTMLElement>('[aria-checked="true"], [role="menuitemradio"]')?.focus())
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerdown)
    document.removeEventListener('keydown', onDocumentKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerdown)
  document.removeEventListener('keydown', onDocumentKeydown)
})

/** Up/Down cycle the options, matching how a menu is expected to behave. */
function onMenuKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const items = Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])
  if (!items.length) return
  const at = items.indexOf(document.activeElement as HTMLElement)
  const step = e.key === 'ArrowDown' ? 1 : -1
  items[(at + step + items.length) % items.length].focus()
}

function choose(value: unknown) {
  emit('select', value)
  close()
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      ref="trigger"
      type="button"
      class="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer
             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      :class="props.active
        ? 'bg-audio-500/15 text-audio-700 dark:text-audio-300'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-800'"
      :aria-label="label"
      :title="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <PlayerIcon :name="icon" :size="16" />
      <span v-if="triggerText">{{ triggerText }}</span>
    </button>

    <div
      v-if="open"
      ref="menu"
      role="menu"
      :aria-label="label"
      class="absolute bottom-full right-0 z-10 mb-2 min-w-[9rem] overflow-hidden rounded-2xl border
             border-gray-200 bg-white py-1 shadow-xl dark:border-gray-800 dark:bg-surface-900"
      @keydown="onMenuKeydown"
    >
      <button
        v-for="option in options"
        :key="String(option.value)"
        type="button"
        role="menuitemradio"
        :aria-checked="option.value === selected"
        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm cursor-pointer
               hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none
               dark:hover:bg-surface-800 dark:focus-visible:bg-surface-800"
        :class="option.value === selected
          ? 'font-semibold text-audio-700 dark:text-audio-300'
          : 'text-gray-700 dark:text-gray-200'"
        @click="choose(option.value)"
      >
        <span>{{ option.label }}</span>
        <span v-if="option.value === selected" aria-hidden="true">•</span>
      </button>
    </div>
  </div>
</template>
