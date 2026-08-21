<script setup lang="ts">
const props = defineProps<{
  label: string
  displayValue: string
  value: number
  max: number
  minLabel: string
  maxLabel: string
  decreaseLabel: string
  increaseLabel: string
}>()

const emit = defineEmits<{
  decrease: []
  increase: []
  change: [value: string]
}>()
</script>

<template>
  <div class="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-surface-800/60">
    <div class="mb-4 flex items-center justify-between gap-4">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ props.label }}</h3>
      <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-600 shadow-sm dark:bg-surface-900 dark:text-brand-300">
        {{ props.displayValue }}
      </span>
    </div>

    <div class="flex items-center gap-3">
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-bold text-gray-600 shadow-sm transition-colors hover:border-brand-200 hover:text-brand-600 disabled:opacity-40 dark:border-gray-700 dark:bg-surface-900 dark:text-gray-300 dark:hover:border-brand-700"
        :disabled="props.value <= 0"
        :aria-label="props.decreaseLabel"
        @click="emit('decrease')"
      >−</button>
      <input
        type="range"
        :value="props.value"
        :min="0"
        :max="props.max"
        class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-500 dark:bg-gray-700"
        @input="emit('change', ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-bold text-gray-600 shadow-sm transition-colors hover:border-brand-200 hover:text-brand-600 disabled:opacity-40 dark:border-gray-700 dark:bg-surface-900 dark:text-gray-300 dark:hover:border-brand-700"
        :disabled="props.value >= props.max"
        :aria-label="props.increaseLabel"
        @click="emit('increase')"
      >+</button>
    </div>

    <div class="mt-3 flex justify-between text-xs font-medium text-gray-400">
      <span>{{ props.minLabel }}</span>
      <span>{{ props.maxLabel }}</span>
    </div>
  </div>
</template>