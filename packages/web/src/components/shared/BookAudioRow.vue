<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AudioTrack } from '@/stores/bookAudio'
import PlayerIcon from '@/components/ui/PlayerIcon.vue'

const { t } = useI18n()

const props = defineProps<{ title: string; tracks: AudioTrack[] }>()

function play(startTrack: AudioTrack) {
  window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', {
    detail: { track: startTrack, queue: props.tracks },
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
        class="shrink-0 w-36 text-left group relative cursor-pointer rounded-xl
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        :aria-label="`${t('music.play')}: ${track.title}`"
        @click="play(track)"
      >
        <div class="aspect-[3/4] rounded-xl bg-gray-100 dark:bg-surface-800 overflow-hidden flex items-center justify-center text-4xl mb-2 shadow-sm group-hover:ring-2 ring-audio-500 transition-all">
          <img v-if="track.cover" :src="track.cover" alt="" class="w-full h-full object-cover" />
          <PlayerIcon v-else name="headphones" :size="34" class="text-audio-600 dark:text-audio-400" />
          <div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity
                      group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
            <PlayerIcon name="play" :size="30" class="text-white" />
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
