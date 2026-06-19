<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const tabs = ['purchased', 'bookmarks', 'downloaded'] as const
</script>
<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('library.title') }}</h1>
    <div class="flex gap-2 mb-6">
      <button v-for="tab in tabs" :key="tab" class="btn-secondary text-sm capitalize">{{ t(`library.${tab}`) }}</button>
    </div>
    <div class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">📁</div>
      <p>Library content — coming soon</p>
    </div>
  </div>
</template>
