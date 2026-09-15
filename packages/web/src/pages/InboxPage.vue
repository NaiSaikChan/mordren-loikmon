<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { misc } from '@loikmon/api'
import type { InboxMessage } from '@loikmon/api'
import { useAuthStore } from '@/stores/auth'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

/** Broadcast announcements for everyone, plus personal messages when signed in. */
const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const notifications = ref<InboxMessage[]>([])
const loading = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const { data } = await misc.fetchInbox()
    notifications.value = data.notifications ?? []
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function formatDate(d: string) {
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString()
}

function iconFor(type: string) {
  if (type === 'subscription') return '👑'
  if (type === 'reply' || type === 'review') return '💬'
  if (type === 'book' || type === 'new_book') return '📚'
  if (type === 'article' || type === 'new_article') return '📰'
  return '🔔'
}

onMounted(load)
watch(() => authStore.token, load)
</script>

<template>
  <div class="page-wrapper max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.inbox') }}</h1>

    <div v-if="!authStore.isLoggedIn" class="card p-4 mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
      <span>{{ t('inbox.signInHint') }}</span>
      <RouterLink :to="{ name: 'auth', query: { redirect: route.fullPath } }" class="btn-primary">{{ t('auth.login') }}</RouterLink>
    </div>

    <LoadingSpinner v-if="loading && !notifications.length" />
    <div v-else-if="failed && !notifications.length" class="card p-10 text-center text-gray-500 dark:text-gray-400">
      <p class="mb-4">{{ t('common.error') }}</p>
      <button type="button" class="btn-primary" @click="load">{{ t('common.retry') }}</button>
    </div>
    <div v-else-if="notifications.length" class="space-y-3">
      <div v-for="n in notifications" :key="n.id" class="card p-4">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0 mt-0.5">
            <span class="text-sm">{{ iconFor(n.type) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ n.title }}</p>
            <p v-if="n.message" class="text-sm text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-line break-words">{{ n.message }}</p>
            <p v-if="n.created_at" class="text-xs text-gray-400 mt-1">{{ formatDate(n.created_at) }}</p>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">📥</div>
      <p>{{ t('inbox.empty') }}</p>
    </div>
  </div>
</template>
