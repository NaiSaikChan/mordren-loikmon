<script setup lang="ts">
defineProps<{ title: string; viewAllPath?: string }>()
</script>

<template>
  <div class="flex items-center justify-between mb-4">
    <h2 class="section-title leading-tight">{{ title }}</h2>
    <RouterLink
      v-if="viewAllPath"
      :to="viewAllPath"
      class="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400 font-medium leading-tight px-3 py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
    >
      View all →
    </RouterLink>
  </div>
</template>
