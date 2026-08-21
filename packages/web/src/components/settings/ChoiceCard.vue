<script setup lang="ts">
const props = withDefaults(defineProps<{
  active: boolean
  icon?: string
  title: string
  description?: string
  previewClass?: string
}>(), {
  icon: '',
  description: '',
  previewClass: '',
})

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <button
    type="button"
    :aria-pressed="props.active"
    :class="[
      'group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-950',
      props.active
        ? 'border-brand-500 bg-brand-50/80 text-brand-800 shadow-sm shadow-brand-200/70 ring-1 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-200 dark:shadow-black/20 dark:ring-brand-800/70'
        : 'border-gray-200 bg-white text-gray-700 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md hover:shadow-gray-200/70 dark:border-gray-800 dark:bg-surface-900 dark:text-gray-300 dark:hover:border-brand-800 dark:hover:shadow-black/20',
    ]"
    @click="emit('select')"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <span v-if="props.icon" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg transition-colors group-hover:bg-brand-50 dark:bg-surface-800 dark:group-hover:bg-brand-900/30">
          {{ props.icon }}
        </span>
        <span class="min-w-0">
          <span class="block font-semibold leading-snug text-gray-950 dark:text-white">{{ props.title }}</span>
          <span v-if="props.description" class="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {{ props.description }}
          </span>
        </span>
      </div>

      <span
        :class="[
          'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors',
          props.active
            ? 'border-brand-500 bg-brand-600 text-white'
            : 'border-gray-300 bg-white text-transparent dark:border-gray-700 dark:bg-surface-900',
        ]"
      >✓</span>
    </div>

    <div v-if="props.previewClass" :class="['mt-4 h-2 rounded-full', props.previewClass]" />
  </button>
</template>