<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { MediaItem } from '@loikmon/api'
import { useBookAudioStore, type AudioTrack } from '@/stores/bookAudio'

declare global {
  interface WindowEventMap {
    'loikmon:playAudioTrack': CustomEvent<{ track: AudioTrack; queue?: AudioTrack[] }>
  }
}

let globalAudio: HTMLAudioElement | null = null

const current = ref<AudioTrack | null>(null)
const playing = ref(false)
const progress = ref(0)
const duration = ref(0)
const loading = ref(false)
const queue = ref<AudioTrack[]>([])
const currentIndex = ref(0)

const audioStore = useBookAudioStore()

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const progressText = computed(() => formatTime((progress.value / 100) * duration.value))
const durationText = computed(() => formatTime(duration.value))

function setCurrent(track: AudioTrack, newQueue: AudioTrack[] = []) {
  current.value = track
  queue.value = newQueue.length ? newQueue : [track]
  const idx = queue.value.findIndex((t) => t.url === track.url)
  currentIndex.value = idx >= 0 ? idx : 0
}

async function playTrack(track: AudioTrack, newQueue?: AudioTrack[]) {
  if (!globalAudio) return
  setCurrent(track, newQueue ?? queue.value)
  loading.value = true
  playing.value = false
  try {
    globalAudio.src = track.url
    globalAudio.load()
    await globalAudio.play()
    playing.value = true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[AudioPlayer] playback error', err)
  } finally {
    loading.value = false
  }
}

function toggle() {
  if (!globalAudio || !current.value) return
  if (playing.value) {
    globalAudio.pause()
    playing.value = false
  } else {
    globalAudio.play().then(() => { playing.value = true }).catch(() => undefined)
  }
}

function close() {
  if (globalAudio) {
    globalAudio.pause()
    globalAudio.removeAttribute('src')
    globalAudio.load()
  }
  current.value = null
  playing.value = false
  progress.value = 0
  duration.value = 0
  queue.value = []
  currentIndex.value = 0
  loading.value = false
}

function seek(percent: number) {
  if (!globalAudio || !duration.value) return
  const bounded = Math.max(0, Math.min(100, percent))
  globalAudio.currentTime = (bounded / 100) * duration.value
}

function playNext() {
  if (!queue.value.length) return
  const nextIndex = currentIndex.value + 1
  if (nextIndex < queue.value.length) {
    void playTrack(queue.value[nextIndex], queue.value)
  }
}

function playPrevious() {
  if (!queue.value.length) return
  const prevIndex = currentIndex.value - 1
  if (prevIndex >= 0) {
    void playTrack(queue.value[prevIndex], queue.value)
  }
}

function onTimeUpdate() {
  if (!globalAudio) return
  duration.value = globalAudio.duration || duration.value
  if (globalAudio.duration) {
    progress.value = (globalAudio.currentTime / globalAudio.duration) * 100
  }
}

function onLoadedMetadata() {
  if (!globalAudio) return
  duration.value = globalAudio.duration || 0
}

function onExternalPlay(e: CustomEvent<{ track: AudioTrack; queue?: AudioTrack[] }>) {
  if (e.detail?.track) {
    void playTrack(e.detail.track, e.detail.queue)
  }
}

defineExpose({
  start: playTrack,
  startFromMedia(media: MediaItem) {
    const rec = media as unknown as Record<string, unknown>
    const url = (rec.audio_url as string) ?? (rec.audio as string) ?? (rec.file as string) ?? ''
    if (!url) return
    const track: AudioTrack = {
      id: (rec.id as string | number) ?? url,
      title: (rec.title as string) ?? 'Untitled',
      artist: (rec.artist as string) ?? (rec.authorname as string) ?? (rec.author as string) ?? '',
      url,
      cover: '',
    }
    void playTrack(track)
  },
})

onMounted(() => {
  if (typeof window === 'undefined') return
  globalAudio = new Audio()
  globalAudio.preload = 'metadata'
  globalAudio.addEventListener('timeupdate', onTimeUpdate)
  globalAudio.addEventListener('ended', playNext)
  globalAudio.addEventListener('loadedmetadata', onLoadedMetadata)
  window.addEventListener('loikmon:playAudioTrack', onExternalPlay)
})

onUnmounted(() => {
  if (globalAudio) {
    globalAudio.pause()
    globalAudio.removeAttribute('src')
    globalAudio.removeEventListener('timeupdate', onTimeUpdate)
    globalAudio.removeEventListener('ended', playNext)
    globalAudio.removeEventListener('loadedmetadata', onLoadedMetadata)
    globalAudio.load()
    globalAudio = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('loikmon:playAudioTrack', onExternalPlay)
  }
})
</script>

<template>
  <Transition name="player">
    <div
      v-if="current"
      class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-surface-900 border-t border-gray-100 dark:border-gray-800 shadow-2xl"
    >
      <div class="h-1 bg-gray-200 dark:bg-gray-700 cursor-pointer group" @click.self="(e) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); seek(((e as MouseEvent).clientX - rect.left) / rect.width * 100) }">
        <div class="h-full bg-brand-500 transition-all relative" :style="{ width: `${progress}%` }">
          <div class="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-brand-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <div class="flex items-center gap-3 px-4 py-2 max-w-screen-xl mx-auto">
        <div class="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-lg shrink-0 overflow-hidden">
          <img v-if="current.cover" :src="current.cover" class="w-full h-full object-cover" />
          <span v-else>🎵</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ current.title }}</p>
          <p class="text-xs text-gray-400 truncate">{{ current.artist || `${progressText} / ${durationText}` }}</p>
        </div>
        <div class="flex items-center gap-1">
          <button class="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-surface-800 flex items-center justify-center text-lg text-gray-600 dark:text-gray-300" @click="playPrevious" :disabled="currentIndex <= 0">⏮</button>
          <button class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center text-lg hover:bg-brand-500 transition-colors" @click="toggle">
            <span v-if="loading" class="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            <span v-else>{{ playing ? '⏸' : '▶️' }}</span>
          </button>
          <button class="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-surface-800 flex items-center justify-center text-lg text-gray-600 dark:text-gray-300" @click="playNext" :disabled="currentIndex >= queue.length - 1">⏭</button>
        </div>
        <button class="btn-ghost p-2 text-gray-400 hover:text-gray-600" @click="close">✕</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.player-enter-active, .player-leave-active { transition: transform 0.2s; }
.player-enter-from, .player-leave-to { transform: translateY(100%); }
</style>
