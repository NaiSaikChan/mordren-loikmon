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
const expanded = ref(false)

const audioStore = useBookAudioStore()

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const progressText = computed(() => formatTime((progress.value / 100) * duration.value))
const durationText = computed(() => formatTime(duration.value))
const chapterQueue = computed<AudioTrack[]>(() => queue.value.length ? queue.value : current.value ? [current.value] : [])

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

function openPlayer() {
  if (current.value) {
    expanded.value = true
  }
}

function closePlayer() {
  expanded.value = false
}

function selectChapter(track: AudioTrack) {
  expanded.value = false
  void playTrack(track, chapterQueue.value)
}

function getChapterLabel(track: AudioTrack, index: number) {
  const fallback = `Chapter ${index + 1}`
  if (!track.title) return fallback
  const chapterTitle = track.title.split(/[\-–—]/).pop()?.trim()
  return chapterTitle || track.title || fallback
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
  expanded.value = false
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
    <div v-if="current" class="fixed inset-x-0 bottom-0 z-50">
      <div
        class="bg-white dark:bg-surface-900 border-t border-gray-100 dark:border-gray-800 shadow-2xl cursor-pointer"
        @click="openPlayer"
      >
        <div class="h-1 bg-gray-200 dark:bg-gray-700 cursor-pointer group" @click.stop="(e) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); seek(((e as MouseEvent).clientX - rect.left) / rect.width * 100) }">
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
            <button class="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-surface-800 flex items-center justify-center text-lg text-gray-600 dark:text-gray-300" @click.stop="playPrevious" :disabled="currentIndex <= 0">⏮</button>
            <button class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center text-lg hover:bg-brand-500 transition-colors" @click.stop="toggle">
              <span v-if="loading" class="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              <span v-else>{{ playing ? '⏸' : '▶️' }}</span>
            </button>
            <button class="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-surface-800 flex items-center justify-center text-lg text-gray-600 dark:text-gray-300" @click.stop="playNext" :disabled="currentIndex >= queue.length - 1">⏭</button>
          </div>
          <button class="btn-ghost p-2 text-gray-400 hover:text-gray-600" @click.stop="close">✕</button>
        </div>
      </div>

      <Transition name="player-panel">
        <div v-if="expanded" class="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-end justify-center p-4 sm:p-6" @click.self="closePlayer">
          <div class="w-full max-w-lg rounded-[28px] bg-white dark:bg-surface-900 shadow-[0_30px_80px_rgba(0,0,0,0.45)] overflow-hidden border border-gray-200 dark:border-gray-800">
            <div class="flex items-center justify-between px-5 pt-5 pb-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 overflow-hidden shrink-0 flex items-center justify-center">
                  <img v-if="current.cover" :src="current.cover" class="w-full h-full object-cover" />
                  <span v-else class="text-xl">🎵</span>
                </div>
                <div class="min-w-0">
                  <p class="text-base font-semibold text-gray-900 dark:text-white truncate">{{ current.title }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ current.artist || `${progressText} / ${durationText}` }}</p>
                </div>
              </div>
              <button class="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-surface-800 text-gray-500 dark:text-gray-300" @click="closePlayer">✕</button>
            </div>

            <div class="px-5 pb-4">
              <div class="rounded-3xl bg-gradient-to-br from-brand-50 via-white to-brand-100 dark:from-brand-900/20 dark:via-surface-900 dark:to-brand-950/20 p-4 border border-brand-100 dark:border-brand-800/40">
                <div class="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                  <span>Now playing</span>
                  <span>{{ currentIndex + 1 }} / {{ chapterQueue.length || 1 }}</span>
                </div>
                <div class="mt-4 flex items-center gap-4">
                  <div class="w-20 h-20 rounded-2xl bg-white/70 dark:bg-surface-800/60 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                    <img v-if="current.cover" :src="current.cover" class="w-full h-full object-cover" />
                    <span v-else class="text-3xl">🎧</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-lg font-semibold text-gray-900 dark:text-white truncate">{{ current.title }}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{{ current.artist || 'Audio chapter' }}</p>
                  </div>
                </div>

                <div class="mt-5">
                  <div class="h-2.5 rounded-full bg-brand-100 dark:bg-surface-800 cursor-pointer group" @click.self="(e) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); seek(((e as MouseEvent).clientX - rect.left) / rect.width * 100) }">
                    <div class="h-full rounded-full bg-brand-500 transition-all" :style="{ width: `${progress}%` }" />
                  </div>
                  <div class="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{{ progressText }}</span>
                    <span>{{ durationText }}</span>
                  </div>
                </div>

                <div class="mt-5 flex items-center justify-center gap-5">
                  <button class="w-11 h-11 rounded-full hover:bg-gray-100 dark:hover:bg-surface-800 text-2xl text-gray-600 dark:text-gray-300" @click="playPrevious" :disabled="currentIndex <= 0">⏮</button>
                  <button class="w-14 h-14 rounded-full bg-brand-600 text-white text-2xl shadow-lg shadow-brand-500/30 hover:bg-brand-500 transition-colors" @click="toggle">
                    <span v-if="loading" class="block w-5 h-5 mx-auto border-2 border-white/60 border-t-white rounded-full animate-spin" />
                    <span v-else>{{ playing ? '⏸' : '▶️' }}</span>
                  </button>
                  <button class="w-11 h-11 rounded-full hover:bg-gray-100 dark:hover:bg-surface-800 text-2xl text-gray-600 dark:text-gray-300" @click="playNext" :disabled="currentIndex >= queue.length - 1">⏭</button>
                </div>
              </div>
            </div>

            <div class="px-5 pb-5">
              <div class="mb-3 flex items-center justify-between">
                <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">#sym:BookAudioChapters</h3>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ chapterQueue.length }} chapters</span>
              </div>
              <div class="max-h-[46vh] overflow-y-auto pr-1 space-y-2">
                <button
                  v-for="(track, index) in chapterQueue"
                  :key="`${String(track.id)}-${index}`"
                  class="w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all"
                  :class="current && current.url === track.url ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-900 hover:border-brand-300 dark:hover:border-brand-700'"
                  @click="selectChapter(track)"
                >
                  <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
                    :class="current && current.url === track.url ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-gray-300'"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ getChapterLabel(track, index) }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ current && current.url === track.url ? (playing ? 'Playing now' : 'Paused') : 'Tap to play' }}
                    </p>
                  </div>
                  <span class="text-lg text-gray-400">{{ current && current.url === track.url && playing ? '⏸' : '▶️' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.player-enter-active, .player-leave-active { transition: transform 0.2s; }
.player-enter-from, .player-leave-to { transform: translateY(100%); }
</style>
