<script setup lang="ts">
const props = defineProps<{ id: string }>()
</script>
<template>
  <div class="page-wrapper max-w-3xl mx-auto">
    <RouterLink to="/articles" class="btn-ghost mb-4 inline-flex">← Back</RouterLink>
    <div class="card p-8">
      <div class="text-center py-12 text-gray-400">
        <div class="text-5xl mb-3">📰</div>
        <p>Article #{{ props.id }} viewer — coming soon</p>
      </div>
    </div>
  </div>
</template>
