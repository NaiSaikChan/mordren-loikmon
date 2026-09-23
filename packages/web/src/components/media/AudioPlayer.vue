<script setup lang="ts">
/**
 * Global audio player, mounted once in the app shell.
 *
 * Owns nothing itself: playback lives in `usePlayerEngine`, and this component
 * only decides whether the mini bar or the expanded sheet is on screen. Entry
 * points stay what they always were — the `loikmon:playAudioTrack` window event
 * and the exposed `start` method.
 */
import { ref, watch } from 'vue'
import { usePlayerEngine } from '@/composables/usePlayerEngine'
import { useMediaSession } from '@/composables/useMediaSession'
import { usePlayerShortcuts } from '@/composables/usePlayerShortcuts'
import MiniPlayer from '@/components/media/MiniPlayer.vue'
import PlayerSheet from '@/components/media/PlayerSheet.vue'

const engine = usePlayerEngine()
useMediaSession(engine)
usePlayerShortcuts(engine)

const expanded = ref(false)

// Nothing playing means nothing to expand.
watch(engine.current, (track) => {
  if (!track) expanded.value = false
})

defineExpose({ start: engine.playTrack })
</script>

<template>
  <Transition name="player">
    <div v-if="engine.current.value" class="fixed inset-x-0 bottom-0 z-50 lg:left-64">
      <MiniPlayer :engine="engine" @expand="expanded = true" />
    </div>
  </Transition>

  <Transition name="player-sheet">
    <PlayerSheet v-if="expanded && engine.current.value" :engine="engine" @close="expanded = false" />
  </Transition>
</template>

<style scoped>
.player-enter-active,
.player-leave-active { transition: transform 0.2s ease; }
.player-enter-from,
.player-leave-to { transform: translateY(100%); }

.player-sheet-enter-active,
.player-sheet-leave-active { transition: opacity 0.18s ease; }
.player-sheet-enter-from,
.player-sheet-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .player-enter-active,
  .player-leave-active,
  .player-sheet-enter-active,
  .player-sheet-leave-active { transition-duration: 1ms; }
}
</style>
