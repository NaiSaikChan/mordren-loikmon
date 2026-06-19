<script setup lang="ts">
import { ref } from 'vue'
import type { MediaItem } from '@loikmon/api'

const current = ref<MediaItem | null>(null)
const playing = ref(false)
const progress = ref(0)

function toggle() { playing.value = !playing.value }
function close() { current.value = null; playing.value = false }
</script>

<template>
  <Transition name="player">
    <div
      v-if="current"
      class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-surface-900 border-t border-gray-100 dark:border-gray-800 shadow-2xl"
    >
      <div class="h-1 bg-gray-200 dark:bg-gray-700">
        <div class="h-full bg-brand-500 transition-all" :style="{ width: `${progress}%` }" />
      </div>
      <div class="flex items-center gap-4 px-4 py-3 max-w-screen-xl mx-auto">
        <div class="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xl">🎵</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ current.title }}</p>
          <p class="text-xs text-gray-400 truncate">{{ current.artist?.name }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center text-lg hover:bg-brand-500 transition-colors" @click="toggle">
            {{ playing ? '⏸' : '▶️' }}
          </button>
          <button class="btn-ghost p-2" @click="close">✕</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.player-enter-active, .player-leave-active { transition: transform 0.2s; }
.player-enter-from, .player-leave-to { transform: translateY(100%); }
</style>
