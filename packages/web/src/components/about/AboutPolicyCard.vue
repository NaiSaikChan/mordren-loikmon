<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
  points: string[]
  href: string
  actionLabel: string
}>()
</script>

<template>
  <article class="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-200/60 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/80 dark:border-gray-800 dark:bg-surface-900 dark:shadow-black/20">
    <div class="mb-4 flex items-start gap-3">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-xl dark:bg-surface-800">
        {{ icon }}
      </div>
      <div>
        <h3 class="font-bold leading-7 text-gray-950 dark:text-white">{{ title }}</h3>
        <p class="mt-1 text-sm leading-7 text-gray-500 dark:text-gray-400">{{ description }}</p>
      </div>
    </div>

    <ul class="mb-5 space-y-2 text-sm text-gray-600 dark:text-gray-300">
      <li v-for="point in points" :key="point" class="flex gap-2 leading-7">
        <span class="mt-1 text-brand-500">✓</span>
        <span>{{ point }}</span>
      </li>
    </ul>

    <a
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-auto inline-flex items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-200 dark:hover:bg-brand-900/50"
    >
      {{ actionLabel }} ↗
    </a>
  </article>
</template>
