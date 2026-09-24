<script setup lang="ts">
/**
 * The expanded player: artwork, full transport, speed, sleep timer, chapters.
 *
 * A real modal dialog — labelled, focus-trapped, dismissed with Escape — where
 * the previous version was a bare `<div>` overlay that keyboard and screen
 * reader users could tab straight out of.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AudioTrack } from '@/stores/bookAudio'
import {
  PLAYBACK_RATES,
  SKIP_SECONDS,
  SLEEP_MINUTES,
  formatTime,
  spokenTime,
  type PlayerEngine,
  type SleepMode,
} from '@/composables/usePlayerEngine'
import IconButton from '@/components/ui/IconButton.vue'
import PlayerIcon from '@/components/ui/PlayerIcon.vue'
import SeekSlider from '@/components/ui/SeekSlider.vue'
import MenuPopover, { type MenuOption } from '@/components/ui/MenuPopover.vue'
import ChapterList from '@/components/media/ChapterList.vue'

const props = defineProps<{ engine: PlayerEngine }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const panel = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const busy = computed(() => props.engine.loading.value || props.engine.buffering.value)

const rateOptions = computed<MenuOption[]>(() =>
  PLAYBACK_RATES.map((value) => ({
    value,
    label: value === 1 ? t('music.normalSpeed') : `${value}×`,
  })),
)

const sleepOptions = computed<MenuOption[]>(() => [
  { value: 'off' as SleepMode, label: t('music.sleepOff') },
  ...SLEEP_MINUTES.map((m) => ({ value: m as SleepMode, label: t('music.sleepMinutes', { count: m }) })),
  { value: 'end-of-chapter' as SleepMode, label: t('music.sleepEndOfChapter') },
])

const sleepTriggerText = computed(() => {
  const mode = props.engine.sleepMode.value
  if (mode === 'off') return undefined
  if (mode === 'end-of-chapter') return t('music.sleepEndOfChapter')
  const left = props.engine.sleepRemainingMs.value
  return left === null ? `${mode}m` : formatTime(left / 1000)
})

const valueText = (seconds: number) =>
  spokenTime(seconds, { minutes: t('music.minutesUnit'), seconds: t('music.secondsUnit') })

function selectChapter(track: AudioTrack) {
  // Locked chapters open the paywall from inside playTrack; the sheet steps aside either way.
  emit('close')
  void props.engine.playTrack(track, props.engine.chapterQueue.value)
}

/** Keeps Tab inside the dialog, as a modal is expected to. */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !panel.value) return
  const focusable = panel.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea',
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null
  void nextTick(() => panel.value?.querySelector<HTMLElement>('button')?.focus())
})

onBeforeUnmount(() => {
  previouslyFocused?.focus?.()
})
</script>

<template>
  <div
    class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <div
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t('music.nowPlaying')"
      class="w-full max-w-lg overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl
             sm:rounded-3xl dark:border-gray-800 dark:bg-surface-900"
    >
      <header class="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-audio-700 dark:text-audio-400">
          {{ t('music.nowPlaying') }}
          <span class="ml-2 text-gray-400 dark:text-gray-500">
            {{ engine.currentIndex.value + 1 }} / {{ engine.chapterQueue.value.length || 1 }}
          </span>
        </p>
        <IconButton icon="chevron-down" :label="t('music.collapsePlayer')" size="sm" @click="emit('close')" />
      </header>

      <div class="px-5 pb-5">
        <!-- Artwork + title. aria-live announces the chapter when it changes under the listener. -->
        <div class="flex items-center gap-4">
          <div class="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-audio-100 shadow-sm dark:bg-audio-950/50">
            <img
              v-if="engine.current.value?.cover"
              :key="String(engine.current.value.id)"
              :src="engine.current.value.cover"
              alt=""
              class="cover-enter h-full w-full object-cover"
            />
            <span v-else class="flex h-full w-full items-center justify-center">
              <PlayerIcon name="headphones" :size="34" class="text-audio-600 dark:text-audio-400" />
            </span>
          </div>
          <div class="min-w-0 flex-1" aria-live="polite">
            <p
              :key="String(engine.current.value?.id)"
              class="track-enter truncate text-lg font-semibold text-gray-900 dark:text-white"
            >
              {{ engine.current.value?.title }}
            </p>
            <p class="truncate text-sm text-gray-500 dark:text-gray-400">
              {{ engine.current.value?.artist || t('books.audiobook') }}
            </p>
            <p v-if="engine.buffering.value" class="mt-1 text-xs text-audio-700 dark:text-audio-400">
              {{ t('music.buffering') }}
            </p>
          </div>
        </div>

        <div class="mt-5">
          <SeekSlider
            :percent="engine.progress.value"
            :duration-seconds="engine.duration.value"
            :label="t('music.position')"
            :value-text="valueText"
            :disabled="!engine.duration.value"
            @seek="engine.seek"
          />
          <div class="mt-1 flex items-center justify-between text-xs tabular-nums text-gray-500 dark:text-gray-400">
            <span>{{ formatTime(engine.elapsed.value) }}</span>
            <span>{{ formatTime(engine.duration.value) }}</span>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-center gap-2 sm:gap-3">
          <IconButton
            icon="previous"
            :label="t('music.previousChapter')"
            :disabled="!engine.hasPrevious.value"
            @click="engine.previous"
          />
          <IconButton
            icon="skip-back"
            :label="t('music.skipBack', { seconds: SKIP_SECONDS })"
            :disabled="!engine.duration.value"
            @click="engine.skip(-SKIP_SECONDS)"
          />

          <button
            type="button"
            class="flex h-16 w-16 items-center justify-center rounded-full bg-audio-500 text-white
                   shadow-xl shadow-audio-500/30 transition-colors cursor-pointer hover:bg-audio-400
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            :aria-label="engine.finished.value
              ? t('music.replay')
              : engine.playing.value ? t('music.pause') : t('music.play')"
            @click="engine.toggle"
          >
            <span
              v-if="busy"
              class="h-6 w-6 animate-spin rounded-full border-2 border-white/50 border-t-white motion-reduce:animate-none"
            />
            <PlayerIcon
              v-else
              :name="engine.finished.value ? 'restart' : engine.playing.value ? 'pause' : 'play'"
              :size="28"
            />
          </button>

          <IconButton
            icon="skip-forward"
            :label="t('music.skipForward', { seconds: SKIP_SECONDS })"
            :disabled="!engine.duration.value"
            @click="engine.skip(SKIP_SECONDS)"
          />
          <IconButton
            icon="next"
            :label="t('music.nextChapter')"
            :disabled="!engine.hasNext.value"
            @click="engine.next"
          />
        </div>

        <div class="mt-4 flex items-center justify-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <MenuPopover
            :label="t('music.speed')"
            icon="speed"
            :trigger-text="engine.rate.value === 1 ? '1×' : `${engine.rate.value}×`"
            :options="rateOptions"
            :selected="engine.rate.value"
            :active="engine.rate.value !== 1"
            @select="(v) => engine.setRate(v as number)"
          />
          <MenuPopover
            :label="t('music.sleepTimer')"
            icon="moon"
            :trigger-text="sleepTriggerText"
            :options="sleepOptions"
            :selected="engine.sleepMode.value"
            :active="engine.sleepMode.value !== 'off'"
            @select="(v) => engine.setSleep(v as SleepMode)"
          />
          <IconButton icon="close" :label="t('music.closePlayer')" size="sm" @click="engine.close(); emit('close')" />
        </div>
      </div>

      <div class="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
        <ChapterList :engine="engine" @select="selectChapter" />
      </div>
    </div>
  </div>
</template>
