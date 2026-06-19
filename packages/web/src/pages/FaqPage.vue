<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<template>
  <div class="page-wrapper max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.faq') }}</h1>
    <div class="card p-12 text-center text-gray-400"><div class="text-6xl mb-4">❓</div><p>FAQ — loading from API</p></div>
  </div>
</template>
