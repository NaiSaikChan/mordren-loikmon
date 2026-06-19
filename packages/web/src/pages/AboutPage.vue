<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<template>
  <div class="page-wrapper max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.about') }}</h1>
    <div class="card p-8 prose dark:prose-invert max-w-none">
      <p>Loikmon is a digital library for Mon language books, articles, and audio content. The platform aims to preserve and promote Mon literature and culture.</p>
      <p>Built with Vue 3, Node.js, and love for the Mon community.</p>
    </div>
  </div>
</template>
