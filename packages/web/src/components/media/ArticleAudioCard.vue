<script setup lang="ts">
defineProps<{
  title: string
  artist?: string
  cover?: string
  actionLabel: string
}>()

defineEmits<{ play: [] }>()
</script>

<template>
  <div
    class="card p-4 mb-6 flex items-center gap-4 border border-brand-100 dark:border-brand-900/40 bg-brand-50/60 dark:bg-brand-900/10">
    <div
      class="w-14 h-14 rounded-xl overflow-hidden bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-2xl shrink-0">
      <img v-if="cover" :src="cover" :alt="title" class="w-full h-full object-cover"
        @error="($event.target as HTMLImageElement).style.display = 'none'" />
      <span v-else>🎧</span>
    </div>

    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ title }}</p>
      <p v-if="artist" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ artist }}</p>
    </div>

    <button class="btn-primary shrink-0 inline-flex items-center gap-2" @click="$emit('play')">
      <span>▶️</span>
      <span>{{ actionLabel }}</span>
    </button>
  </div>
</template>
