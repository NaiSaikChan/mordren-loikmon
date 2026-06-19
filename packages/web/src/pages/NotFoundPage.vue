<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface-950">
    <div class="text-center">
      <div class="text-8xl mb-6">404</div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">{{ t('common.notFound') }}</h1>
      <p class="text-gray-400 mb-8">The page you're looking for doesn't exist.</p>
      <RouterLink to="/" class="btn-primary">← Go Home</RouterLink>
    </div>
  </div>
</template>
