<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('music.title') }}</h1>
    <div class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">🎵</div>
      <p class="text-lg">Music browser — {{ t('common.comingSoon') }}</p>
    </div>
  </div>
</template>
