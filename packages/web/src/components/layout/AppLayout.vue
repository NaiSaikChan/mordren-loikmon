<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTopBar from './AppTopBar.vue'
import AudioPlayer from '@/components/media/AudioPlayer.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePurchasesStore } from '@/stores/purchases'

const authStore = useAuthStore()
const uiStore = useUiStore()
const purchasesStore = usePurchasesStore()

onMounted(async () => {
  await authStore.restore()
  if (authStore.isLoggedIn) purchasesStore.fetchAll()
})
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

      <main class="flex-1 overflow-y-auto">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
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
