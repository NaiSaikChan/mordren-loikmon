<script setup lang="ts">
defineProps<{ title: string; viewAllPath?: string }>()
</script>

<template>
  <div class="flex items-center justify-between mb-4">
    <h2 class="section-title">{{ title }}</h2>
    <RouterLink v-if="viewAllPath" :to="viewAllPath" class="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400 font-medium">
      View all →
    </RouterLink>
  </div>
</template>
