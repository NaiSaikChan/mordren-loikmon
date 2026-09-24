<script setup lang="ts">
/**
 * The book's chapters, in order. Locked chapters stay visible on purpose: they
 * show what a subscription unlocks, and selecting one opens the paywall rather
 * than playing anything.
 */
import { useI18n } from 'vue-i18n'
import type { AudioTrack } from '@/stores/bookAudio'
import { formatTime, type PlayerEngine } from '@/composables/usePlayerEngine'
import PlayerIcon from '@/components/ui/PlayerIcon.vue'

const props = defineProps<{ engine: PlayerEngine }>()
const emit = defineEmits<{ select: [track: AudioTrack] }>()

const { t } = useI18n()

/**
 * Chapter titles arrive prefixed with the book ("Mon Chronicles – Chapter 3"),
 * which is redundant in a list that is already about one book.
 */
function chapterLabel(track: AudioTrack, index: number) {
  const fallback = `${t('books.chapters')} ${index + 1}`
  if (!track.title) return fallback
  const tail = track.title.split(/[\-–—]/).pop()?.trim()
  return tail || track.title || fallback
}

function statusLabel(track: AudioTrack) {
  if (track.locked) return t('access.locked')
  if (props.engine.isCurrent(track) && props.engine.playing.value) return t('music.pause')
  return t('music.play')
}
</script>

<template>
  <section aria-labelledby="player-chapter-heading">
    <div class="mb-3 flex items-center justify-between">
      <h3
        id="player-chapter-heading"
        class="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400"
      >
        {{ t('music.chapterList') }}
      </h3>
      <span class="text-xs text-gray-500 dark:text-gray-400">{{ engine.chapterQueue.value.length }}</span>
    </div>

    <ul class="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
      <li v-for="(track, index) in engine.chapterQueue.value" :key="`${String(track.id)}-${index}`">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors cursor-pointer
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :class="engine.isCurrent(track)
            ? 'border-audio-400 bg-audio-50 dark:border-audio-700 dark:bg-audio-950/40'
            : track.locked
              ? 'border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-surface-800/40'
              : 'border-gray-200 bg-white hover:border-audio-300 dark:border-gray-800 dark:bg-surface-900 dark:hover:border-audio-700'"
          :aria-current="engine.isCurrent(track) ? 'true' : undefined"
          :data-locked="track.locked ? 'true' : 'false'"
          @click="emit('select', track)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
            :class="engine.isCurrent(track)
              ? 'bg-audio-500 text-white'
              : 'bg-gray-100 text-gray-500 dark:bg-surface-800 dark:text-gray-300'"
            aria-hidden="true"
          >{{ index + 1 }}</span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">
              {{ chapterLabel(track, index) }}
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400">
              {{ statusLabel(track) }}
              <template v-if="track.durationSeconds">· {{ formatTime(track.durationSeconds) }}</template>
            </span>
          </span>

          <PlayerIcon
            :name="track.locked ? 'lock' : engine.isCurrent(track) && engine.playing.value ? 'pause' : 'play'"
            :size="18"
            class="text-gray-400 dark:text-gray-500"
          />
        </button>
      </li>
    </ul>
  </section>
</template>
