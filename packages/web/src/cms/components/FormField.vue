<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * Label + control + help/error wiring. The generated id is passed back through
 * the default slot so the control it wraps is properly labelled.
 */
const props = defineProps<{
  label: string
  help?: string
  error?: string | null
  required?: boolean
  /** Renders the label visually hidden while keeping it for assistive tech. */
  hideLabel?: boolean
}>()

const id = useId()
const describedBy = computed(() => (props.error ? `${id}-error` : props.help ? `${id}-help` : undefined))
</script>

<template>
  <div>
    <label :for="id" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" :class="hideLabel ? 'sr-only' : ''">
      {{ label }}
      <span v-if="required" class="text-red-500" aria-hidden="true">*</span>
    </label>

    <slot :id="id" :described-by="describedBy" :invalid="Boolean(error)" />

    <p v-if="error" :id="`${id}-error`" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-else-if="help" :id="`${id}-help`" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ help }}</p>
  </div>
</template>
