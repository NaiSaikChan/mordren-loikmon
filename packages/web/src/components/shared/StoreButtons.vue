<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { APP_STORE_URL, PLAY_STORE_URL } from '@/config'

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <a
      :href="PLAY_STORE_URL"
      target="_blank"
      rel="noopener"
      class="inline-flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-2.5 text-white shadow-sm transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      data-testid="store-google-play"
    >
      <span class="text-2xl" aria-hidden="true">▶</span>
      <span class="text-left leading-tight">
        <span class="block text-sm font-semibold">{{ t('subscription.getOnGooglePlay') }}</span>
      </span>
    </a>
    <a
      :href="APP_STORE_URL"
      target="_blank"
      rel="noopener"
      class="inline-flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-2.5 text-white shadow-sm transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      data-testid="store-app-store"
    >
      <span class="text-2xl" aria-hidden="true">🍎</span>
      <span class="text-left leading-tight">
        <span class="block text-sm font-semibold">{{ t('subscription.downloadOnAppStore') }}</span>
      </span>
    </a>
  </div>
</template>
