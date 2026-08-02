<script setup lang="ts">
import type { AudioTrack } from '@/stores/bookAudio'

defineProps<{ title: string; tracks: AudioTrack[] }>()

function play(track: AudioTrack) {
  window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', {
    detail: { track, queue: [] },
  }))
}
</script>

<template>
  <section>
    <div class="flex items-center justify-between mb-4">
      <h2 class="section-title !mb-0">{{ title }}</h2>
    </div>
    <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
      <button
        v-for="track in tracks.slice(0, 12)"
        :key="track.id"
        class="shrink-0 w-36 text-left group"
        @click="play(track)"
      >
        <div class="aspect-[3/4] rounded-xl bg-gray-100 dark:bg-surface-800 overflow-hidden flex items-center justify-center text-4xl mb-2 shadow-sm group-hover:ring-2 ring-brand-500 transition-all">
          <span v-if="track.cover">
            <img :src="track.cover" class="w-full h-full object-cover" />
          </span>
          <span v-else>🎧</span>
          <div class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="text-white text-2xl">▶️</span>
          </div>
        </div>
        <p class="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2">{{ track.title }}</p>
        <p v-if="track.artist" class="text-xs text-gray-400 truncate">{{ track.artist }}</p>
      </button>
    </div>
  </section>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
</style>
