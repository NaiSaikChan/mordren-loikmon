<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTopBar from './AppTopBar.vue'
import AudioPlayer from '@/components/media/AudioPlayer.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePurchasesStore } from '@/stores/purchases'

const authStore = useAuthStore()
const uiStore = useUiStore()
const purchasesStore = usePurchasesStore()
const route = useRoute()
const mainEl = useTemplateRef<HTMLElement>('main')

async function scrollMainToTop() {
  await nextTick()
  mainEl.value?.scrollTo({ top: 0, left: 0 })
}

onMounted(async () => {
  window.addEventListener('loikmon:scroll-main-top', scrollMainToTop)
  await authStore.restore()
  if (authStore.isLoggedIn) purchasesStore.fetchAll()
})

onUnmounted(() => {
  window.removeEventListener('loikmon:scroll-main-top', scrollMainToTop)
})

watch(
  () => route.fullPath,
  scrollMainToTop,
)
</script>

<template>
  <div class="flex h-full bg-surface-50 dark:bg-surface-950">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Overlay for mobile sidebar -->
    <Transition name="fade">
      <div
        v-if="uiStore.sidebarOpen"
        class="fixed inset-0 z-20 bg-black/50 lg:hidden"
        @click="uiStore.closeSidebar()"
      />
    </Transition>

    <!-- Main area -->
    <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
      <AppTopBar />

      <main ref="main" class="flex flex-col flex-1 overflow-y-auto">
        <RouterView v-slot="{ Component, route: viewRoute }">
          <Transition name="page" mode="out-in">
            <div :key="viewRoute.fullPath" class="h-full min-h-full">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- Global audio player -->
    <AudioPlayer />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.page-enter-active, .page-leave-active { transition: opacity 0.15s, transform 0.15s; }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to   { opacity: 0; transform: translateY(-8px); }
</style>
