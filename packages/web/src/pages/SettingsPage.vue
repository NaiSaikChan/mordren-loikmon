<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import type { Theme } from '@/stores/ui'

const { t } = useI18n()
const uiStore = useUiStore()

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
]
</script>

<template>
  <div class="page-wrapper max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('settings.title') }}</h1>

    <div class="card p-6 mb-4">
      <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-4">{{ t('settings.theme') }}</h2>
      <div class="flex gap-3">
        <button
          v-for="th in themes"
          :key="th.value"
          :class="['flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
            uiStore.theme === th.value
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600']"
          @click="uiStore.setTheme(th.value)"
        >
          <span>{{ th.icon }}</span>
          <span>{{ th.label }}</span>
        </button>
      </div>
    </div>

    <div class="card p-6">
      <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-4">{{ t('settings.language') }}</h2>
      <div class="flex gap-3">
        <button
          v-for="lang in ([{ value: 'en', label: 'English' }, { value: 'mon', label: 'မန်ဘာသာ' }] as const)"
          :key="lang.value"
          :class="['flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
            uiStore.locale === lang.value
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300']"
          @click="uiStore.setLocale(lang.value)"
        >
          {{ lang.label }}
        </button>
      </div>
    </div>
  </div>
</template>
