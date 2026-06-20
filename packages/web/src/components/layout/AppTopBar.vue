<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import type { Theme, Locale } from '@/stores/ui'

const { t, locale } = useI18n()
const router = useRouter()
const uiStore = useUiStore()
const authStore = useAuthStore()
const searchQuery = ref('')

function handleSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/search', query: { q: searchQuery.value } })
    searchQuery.value = ''
  }
}

function cycleTheme() {
  const order: Theme[] = ['light', 'dark', 'system']
  const idx = order.indexOf(uiStore.theme)
  uiStore.setTheme(order[(idx + 1) % order.length])
}

function toggleLocale() {
  const next: Locale = uiStore.locale === 'en' ? 'mon' : 'en'
  uiStore.setLocale(next)
  locale.value = next
}

function logout() {
  authStore.logout()
  router.push('/')
}

const themeIcon = { light: '☀️', dark: '🌙', system: '💻' }
</script>

<template>
  <header class="h-14 flex items-center gap-3 px-4 bg-white dark:bg-surface-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
    <!-- Hamburger (mobile) -->
    <button class="lg:hidden btn-ghost p-2 -ml-1" @click="uiStore.toggleSidebar()">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>

    <!-- Search bar -->
    <form class="flex-1 max-w-xl" @submit.prevent="handleSearch">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          v-model="searchQuery"
          class="input pl-9 pr-4 h-9 text-sm"
          :placeholder="t('search.placeholder')"
        />
      </div>
    </form>

    <div class="flex items-center gap-1 ml-auto">
      <!-- Locale toggle -->
      <button class="btn-ghost px-2.5 py-1.5 text-xs font-semibold rounded-lg" @click="toggleLocale">
        {{ uiStore.locale === 'en' ? 'မန်' : 'EN' }}
      </button>

      <!-- Theme toggle -->
      <button class="btn-ghost p-2 rounded-lg text-base" :title="`Theme: ${uiStore.theme}`" @click="cycleTheme">
        {{ themeIcon[uiStore.theme] }}
      </button>

      <!-- Inbox -->
      <button class="btn-ghost p-2 rounded-lg text-base" @click="$router.push('/inbox')">📬</button>

      <!-- Auth: Login button or user avatar+logout -->
      <template v-if="authStore.isLoggedIn">
        <div class="flex items-center gap-2 pl-1 border-l border-gray-200 dark:border-gray-700 ml-1">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block truncate max-w-[100px]">
            {{ authStore.displayName }}
          </span>
          <button class="btn-ghost px-2.5 py-1.5 text-xs" @click="logout">
            {{ t('nav.logout') }}
          </button>
        </div>
      </template>
      <template v-else>
        <RouterLink
          to="/auth"
          class="ml-1 btn-primary px-3 py-1.5 text-xs"
        >
          {{ t('nav.login') }}
        </RouterLink>
      </template>
    </div>
  </header>
</template>
