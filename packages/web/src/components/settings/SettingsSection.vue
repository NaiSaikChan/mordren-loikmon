<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <section class="rounded-3xl border border-gray-100 bg-white/90 p-5 shadow-sm shadow-gray-200/60 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/70 dark:border-gray-800 dark:bg-surface-900/90 dark:shadow-black/20 sm:p-6">
    <div class="mb-5 flex items-start gap-4">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl ring-1 ring-brand-100 dark:bg-brand-900/30 dark:ring-brand-800/60">
        {{ icon }}
      </div>
      <div>
        <h2 class="text-lg font-bold text-gray-950 dark:text-white">{{ title }}</h2>
        <p v-if="description" class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          {{ description }}
        </p>
      </div>
    </div>

    <slot />
  </section>
</template>