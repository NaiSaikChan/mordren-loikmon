<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePurchasesStore } from '@/stores/purchases'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const purchasesStore = usePurchasesStore()

const navItems = computed(() => [
  { key: 'home',        icon: '🏠', label: t('nav.home'),       path: '/' },
  { key: 'books',       icon: '📚', label: t('nav.books'),      path: '/books' },
  { key: 'articles',    icon: '📰', label: t('nav.articles'),   path: '/articles' },
  { key: 'authors',     icon: '✍️',  label: t('nav.authors'),   path: '/authors' },
  { key: 'music',       icon: '🎵', label: t('nav.music'),      path: '/music' },
  // { key: 'search',      icon: '🔍', label: t('nav.search'),     path: '/search' },
  { key: 'library',     icon: '📁', label: t('nav.library'),    path: '/library' },
  { key: 'purchases',   icon: '💳', label: t('nav.purchases'),  path: '/purchases' },
  { key: 'collections', icon: '📦', label: t('nav.collections'), path: '/collections' },
  { key: 'inbox',       icon: '📬', label: 'Inbox',              path: '/inbox' },
])

const bottomItems = computed(() => [
  { key: 'settings', icon: '⚙️', label: t('nav.settings'), path: '/settings' },
  { key: 'faq',      icon: '❓', label: t('nav.faq'),       path: '/faq' },
  { key: 'about',    icon: 'ℹ️', label: t('nav.about'),    path: '/about' },
])

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function navigate(path: string) {
  router.push(path)
  uiStore.closeSidebar()
}

async function handleLogout() {
  await authStore.logout()
  router.push('/auth')
}
</script>

<template>
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-white dark:bg-surface-900',
      'border-r border-gray-100 dark:border-gray-800 transition-transform duration-200',
      'lg:translate-x-0 lg:static lg:z-auto',
      uiStore.sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <!-- Logo -->
    <div class="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800">
      <div class="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white text-lg">
        📚
      </div>
      <div>
        <div class="font-bold text-gray-900 dark:text-white text-sm leading-tight">Loikmon</div>
        <div class="text-xs text-gray-400">Mon Digital Library</div>
      </div>
    </div>

    <!-- User pill -->
    <div v-if="authStore.user" class="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
      <div class="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-gray-50 dark:bg-surface-800">
        <div class="w-8 h-8 rounded-full bg-brand-200 dark:bg-brand-800 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold text-sm">
          {{ authStore.displayName.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ authStore.displayName }}</div>
          <div class="text-xs text-gray-400 truncate">{{ purchasesStore.coinBalance }} coins</div>
        </div>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
      <button
        v-for="item in navItems"
        :key="item.key"
        :class="['nav-link w-full text-left', isActive(item.path) && 'nav-link-active']"
        @click="navigate(item.path)"
      >
        <span class="text-base leading-none">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <!-- Bottom -->
    <div class="px-3 py-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
      <button
        v-for="item in bottomItems"
        :key="item.key"
        :class="['nav-link w-full text-left', isActive(item.path) && 'nav-link-active']"
        @click="navigate(item.path)"
      >
        <span class="text-base leading-none">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </button>
      <button class="nav-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" @click="handleLogout">
        <span>🚪</span>
        <span>Logout</span>
      </button>
    </div>
  </aside>
</template>
