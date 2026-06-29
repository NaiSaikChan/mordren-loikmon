<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <div class="page-wrapper max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.about') }}</h1>

    <div class="card p-8 mb-6 text-center">
      <div class="w-20 h-20 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4 text-4xl">📚</div>
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Loikmon Mon Digital Library</h2>
      <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
        A digital platform dedicated to preserving and sharing Mon language literature,
        books, and cultural content for readers worldwide.
      </p>
    </div>

    <div class="space-y-4">
      <div v-for="item in [
        { icon: '📚', title: 'Books', desc: 'Thousands of Mon language books across all categories' },
        { icon: '📰', title: 'Articles', desc: 'Articles on Mon history, culture, and modern topics' },
        { icon: '🎵', title: 'Music', desc: 'Mon traditional and modern music collections' },
        { icon: '✍️', title: 'Authors', desc: 'Discover and follow Mon authors and contributors' },
      ]" :key="item.title" class="card p-5 flex items-start gap-4">
        <div class="text-2xl shrink-0">{{ item.icon }}</div>
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-1">{{ item.title }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ item.desc }}</p>
        </div>
      </div>
    </div>

    <div class="card p-6 mt-6 text-center text-sm text-gray-400">
      <p>🌐 <a href="https://loikmon.org" target="_blank" class="text-brand-500 hover:underline">loikmon.org</a></p>
      <p class="mt-1">Mon Digital Library — Preserving Mon Heritage</p>
    </div>
  </div>
</template>
