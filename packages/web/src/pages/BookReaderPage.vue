<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ id: string }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="h-12 bg-white dark:bg-surface-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-3">
      <RouterLink to=".." class="btn-ghost p-2">← {{ t('common.back') }}</RouterLink>
      <h1 class="font-semibold text-sm text-gray-700 dark:text-gray-300">Book Reader</h1>
    </div>
    <div class="flex-1 flex items-center justify-center bg-gray-50 dark:bg-surface-950">
      <div class="text-center">
        <div class="text-6xl mb-4">📖</div>
        <p class="text-gray-500 dark:text-gray-400">PDF/EPUB reader — {{ t('common.comingSoon') }}</p>
      </div>
    </div>
  </div>
</template>
