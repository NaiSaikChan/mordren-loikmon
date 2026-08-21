<script setup lang="ts">
defineProps<{
  value: string
  label: string
  description: string
}>()
</script>

<template>
  <div class="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm shadow-gray-200/70 backdrop-blur dark:border-white/10 dark:bg-surface-900/75 dark:shadow-black/20">
    <p class="text-2xl font-black text-brand-600 dark:text-brand-300">{{ value }}</p>
    <h3 class="mt-2 text-sm font-bold text-gray-950 dark:text-white">{{ label }}</h3>
    <p class="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{{ description }}</p>
  </div>
</template>
