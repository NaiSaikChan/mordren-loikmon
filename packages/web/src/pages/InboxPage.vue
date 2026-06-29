<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { misc } from '@loikmon/api'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const notifications = ref<any[]>([])
const loading = ref(false)

onMounted(async () => {
  if (!authStore.isLoggedIn) return
  loading.value = true
  try {
    const res = await misc.fetchInbox(authStore.user?.email as string, 0)
    const body = res.data as any
    notifications.value = body.inbox ?? body.notifications ?? body.messages ?? []
  } finally { loading.value = false }
})

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString() } catch { return d }
}
</script>

<template>
  <div class="page-wrapper max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.inbox') }}</h1>

    <div v-if="!authStore.isLoggedIn" class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">📥</div>
      <p class="mb-4">Login to view your inbox</p>
      <RouterLink to="/auth" class="btn-primary inline-flex">Login</RouterLink>
    </div>

    <div v-else>
      <LoadingSpinner v-if="loading" />
      <div v-else-if="notifications.length" class="space-y-3">
        <div v-for="n in notifications" :key="n.id ?? n.message"
          :class="['card p-4', n.read ? 'opacity-70' : 'border-brand-300 dark:border-brand-700']">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0 mt-0.5">
              <span class="text-sm">{{ n.type === 'purchase' ? '🛒' : n.type === 'reply' ? '💬' : '🔔' }}</span>
            </div>
            <div class="flex-1">
              <p class="text-sm text-gray-900 dark:text-white">{{ n.message ?? n.content ?? n.title }}</p>
              <p v-if="n.created_at ?? n.date" class="text-xs text-gray-400 mt-1">
                {{ formatDate(n.created_at ?? n.date) }}
              </p>
            </div>
            <div v-if="!n.read" class="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-2"></div>
          </div>
        </div>
      </div>
      <div v-else class="card p-12 text-center text-gray-400">
        <div class="text-6xl mb-4">📥</div>
        <p>No notifications yet</p>
      </div>
    </div>
  </div>
</template>
