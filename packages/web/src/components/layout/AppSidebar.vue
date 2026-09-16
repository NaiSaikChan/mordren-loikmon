<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useCmsSessionStore } from '@/cms/stores/session'
import logoUrl from '@/assets/logo.png'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const cmsSession = useCmsSessionStore()

// Staff accounts get a link into the CMS. The permission set is fetched once,
// only for signed-in users, and the CMS bundle itself stays lazily loaded.
watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) void cmsSession.ensureLoaded()
    else cmsSession.reset()
  },
  { immediate: true },
)

const navItems = computed(() => [
  { key: 'home',         icon: '🏠', label: t('nav.home'),         path: '/' },
  { key: 'books',        icon: '📚', label: t('nav.books'),        path: '/books' },
  { key: 'articles',     icon: '📰', label: t('nav.articles'),     path: '/articles' },
  { key: 'authors',      icon: '✍️',  label: t('nav.authors'),     path: '/authors' },
  { key: 'library',      icon: '📁', label: t('nav.library'),      path: '/library' },
  { key: 'subscription', icon: '👑', label: t('nav.subscription'), path: '/subscription' },
  { key: 'collections',  icon: '📦', label: t('nav.collections'),  path: '/collections' },
  { key: 'inbox',        icon: '📬', label: t('nav.inbox'),        path: '/inbox' },
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
  if (route.path === path) {
    window.dispatchEvent(new CustomEvent('loikmon:scroll-main-top'))
  } else {
    router.push(path)
  }
  uiStore.closeSidebar()
}

async function handleLogout() {
  await authStore.logout()
  uiStore.closeSidebar()
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
    <button
      type="button"
      class="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-5 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-surface-800"
      @click="navigate('/')"
    >
      <div class="w-9 h-9 rounded-xl overflow-hidden bg-white flex items-center justify-center shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
        <img :src="logoUrl" alt="Loikmon" class="w-full h-full object-contain" />
      </div>
      <div>
        <div class="font-bold text-gray-900 dark:text-white text-sm leading-tight">{{ t('app.name') }}</div>
        <div class="text-xs text-gray-400 pt-2">{{ t('app.tagline') }}</div>
      </div>
    </button>

    <!-- User pill: subscription status -->
    <div v-if="authStore.user" class="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
      <button
        type="button"
        class="flex w-full items-center gap-2.5 px-2 py-2 rounded-xl bg-gray-50 text-left transition-colors hover:bg-gray-100 dark:bg-surface-800 dark:hover:bg-surface-700"
        @click="navigate('/subscription')"
      >
        <div class="w-8 h-8 rounded-full bg-brand-200 dark:bg-brand-800 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold text-sm">
          {{ authStore.displayName.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ authStore.displayName }}</div>
          <div v-if="authStore.isSubscribed" class="text-xs font-semibold text-amber-600 dark:text-amber-400 truncate">
            👑 {{ t('subscription.premiumActive') }}
          </div>
          <div v-else class="text-xs text-gray-400 truncate">
            {{ t('subscription.freePlan') }} · <span class="text-brand-600 dark:text-brand-400">{{ t('subscription.upgrade') }}</span>
          </div>
        </div>
      </button>
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
      <button
        v-if="cmsSession.canAccess"
        :class="['nav-link w-full text-left', isActive('/cms') && 'nav-link-active']"
        @click="navigate('/cms')"
      >
        <span class="text-base leading-none">🛠️</span>
        <span>{{ t('nav.cms') }}</span>
      </button>
      <button
        v-if="authStore.isLoggedIn"
        class="nav-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        @click="handleLogout"
      >
        <span>🚪</span>
        <span>{{ t('nav.logout') }}</span>
      </button>
      <button v-else class="nav-link w-full text-left" @click="navigate('/auth')">
        <span>🔐</span>
        <span>{{ t('nav.login') }}</span>
      </button>
    </div>
  </aside>
</template>
