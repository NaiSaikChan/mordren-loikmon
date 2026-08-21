<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
}>()
</script>

<template>
  <article class="group relative rounded-3xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-200/60 transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-gray-200/80 dark:border-gray-800 dark:bg-surface-900 dark:shadow-black/20 dark:hover:border-brand-800">
    <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl ring-1 ring-brand-100 transition-transform group-hover:scale-105 dark:bg-brand-900/30 dark:ring-brand-800/60">
      {{ icon }}
    </div>
    <h3 class="text-base font-bold leading-7 text-gray-950 dark:text-white">{{ title }}</h3>
    <p class="mt-2 text-sm leading-7 text-gray-500 dark:text-gray-400">{{ description }}</p>
  </article>
</template>
