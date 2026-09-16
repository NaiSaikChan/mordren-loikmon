<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useCmsSessionStore } from '@/cms/stores/session'
import type { Theme } from '@/stores/ui'
import CmsSidebar from './CmsSidebar.vue'
import ConfirmDialog from '@/cms/components/ConfirmDialog.vue'
import ToastHost from '@/cms/components/ToastHost.vue'

/**
 * Shell of the admin application: navigation, the top bar and the global
 * dialog/notification hosts. The route guard has already confirmed the session
 * may be here, so this component only renders.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const session = useCmsSessionStore()

const sidebarOpen = ref(false)

watch(() => route.fullPath, () => (sidebarOpen.value = false))

function cycleTheme() {
  const order: Theme[] = ['light', 'dark', 'system']
  ui.setTheme(order[(order.indexOf(ui.theme) + 1) % order.length])
}

async function signOut() {
  await auth.logout()
  session.reset()
  void router.push('/')
}

const themeIcon = { light: '☀️', dark: '🌙', system: '💻' }
</script>

<template>
  <div class="flex h-full bg-surface-50 dark:bg-surface-950">
    <a
      href="#cms-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
    >
      Skip to content
    </a>

    <CmsSidebar :open="sidebarOpen" @close="sidebarOpen = false" />

    <Transition name="fade">
      <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-black/50 lg:hidden" @click="sidebarOpen = false" />
    </Transition>

    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header
        class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-surface-900 print:hidden"
      >
        <button type="button" class="btn-ghost -ml-1 p-2 lg:hidden" aria-label="Open navigation" @click="sidebarOpen = true">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <p class="truncate text-sm font-medium text-gray-600 dark:text-gray-300">
          {{ route.meta.title ?? 'CMS' }}
        </p>

        <div class="ml-auto flex items-center gap-1">
          <span
            v-if="session.isOwnScope"
            class="badge-yellow hidden sm:inline-flex"
            title="You can only manage content linked to your own author profile"
          >
            Own content
          </span>
          <button
            type="button"
            class="btn-ghost rounded-lg p-2 text-base"
            :title="`Theme: ${ui.theme}`"
            :aria-label="`Change theme, currently ${ui.theme}`"
            @click="cycleTheme"
          >
            {{ themeIcon[ui.theme] }}
          </button>
          <button type="button" class="btn-ghost px-2.5 py-1.5 text-xs" @click="signOut">Sign out</button>
        </div>
      </header>

      <main id="cms-content" class="flex-1 overflow-y-auto" tabindex="-1">
        <div class="mx-auto w-full max-w-7xl p-4 sm:p-6">
          <RouterView v-slot="{ Component }">
            <Suspense>
              <component :is="Component" />
              <template #fallback>
                <div class="space-y-3">
                  <div class="skeleton h-8 w-52" />
                  <div class="skeleton h-64 w-full" />
                </div>
              </template>
            </Suspense>
          </RouterView>
        </div>
      </main>
    </div>

    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
