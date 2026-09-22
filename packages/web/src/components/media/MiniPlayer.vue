<script setup lang="ts">
/**
 * The bar pinned to the bottom of every page.
 *
 * The whole bar used to be a clickable `<div>`, which keyboard users could not
 * reach. Expanding is now an explicit button, and the scrubber sits above the
 * bar as a real slider.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { SKIP_SECONDS, formatTime, spokenTime, type PlayerEngine } from '@/composables/usePlayerEngine'
import IconButton from '@/components/ui/IconButton.vue'
import SeekSlider from '@/components/ui/SeekSlider.vue'
import PlayerIcon from '@/components/ui/PlayerIcon.vue'

const props = defineProps<{ engine: PlayerEngine }>()
const emit = defineEmits<{ expand: [] }>()

const { t } = useI18n()

const busy = computed(() => props.engine.loading.value || props.engine.buffering.value)
const subtitle = computed(() => {
  if (props.engine.buffering.value) return t('music.buffering')
  if (props.engine.finished.value) return t('music.finished')
  return props.engine.current.value?.artist
    || `${formatTime(props.engine.elapsed.value)} / ${formatTime(props.engine.duration.value)}`
})

const valueText = (seconds: number) =>
  spokenTime(seconds, { minutes: t('music.minutesUnit'), seconds: t('music.secondsUnit') })
</script>

<template>
  <div class="border-t border-gray-100 bg-white/95 backdrop-blur shadow-2xl dark:border-gray-800 dark:bg-surface-900/95">
    <!-- Scrubber spans the full width, sitting flush on the bar's top edge. -->
    <SeekSlider
      :percent="engine.progress.value"
      :duration-seconds="engine.duration.value"
      :label="t('music.position')"
      :value-text="valueText"
      size="thin"
      :disabled="!engine.duration.value"
      @seek="engine.seek"
    />

    <div class="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-4">
      <!-- Cover doubles as the expand affordance, but the accessible name says what it does. -->
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition-colors cursor-pointer
               hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2
               focus-visible:outline-brand-500 dark:hover:bg-surface-800"
        :aria-label="t('music.openPlayer')"
        @click="emit('expand')"
      >
        <span class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-audio-100 dark:bg-audio-950/50">
          <img
            v-if="engine.current.value?.cover"
            :src="engine.current.value.cover"
            alt=""
            class="h-full w-full object-cover"
          />
          <PlayerIcon v-else name="headphones" :size="18" class="text-audio-600 dark:text-audio-400" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold text-gray-900 dark:text-white">
            {{ engine.current.value?.title }}
          </span>
          <span class="block truncate text-xs text-gray-500 dark:text-gray-400">{{ subtitle }}</span>
        </span>
      </button>

      <div class="flex items-center gap-0.5 sm:gap-1">
        <IconButton
          class="hidden sm:inline-flex"
          icon="skip-back"
          :label="t('music.skipBack', { seconds: SKIP_SECONDS })"
          size="sm"
          :disabled="!engine.duration.value"
          @click="engine.skip(-SKIP_SECONDS)"
        />
        <IconButton
          icon="previous"
          :label="t('music.previousChapter')"
          size="sm"
          :disabled="!engine.hasPrevious.value"
          @click="engine.previous"
        />

        <button
          type="button"
          class="relative flex h-11 w-11 items-center justify-center rounded-full bg-audio-500 text-white
                 shadow-lg shadow-audio-500/25 transition-colors cursor-pointer hover:bg-audio-400
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :aria-label="engine.finished.value
            ? t('music.replay')
            : engine.playing.value ? t('music.pause') : t('music.play')"
          @click="engine.toggle"
        >
          <span
            v-if="busy"
            class="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white motion-reduce:animate-none"
          />
          <PlayerIcon
            v-else
            :name="engine.finished.value ? 'restart' : engine.playing.value ? 'pause' : 'play'"
            :size="20"
          />
        </button>

        <IconButton
          icon="next"
          :label="t('music.nextChapter')"
          size="sm"
          :disabled="!engine.hasNext.value"
          @click="engine.next"
        />
        <IconButton
          class="hidden sm:inline-flex"
          icon="skip-forward"
          :label="t('music.skipForward', { seconds: SKIP_SECONDS })"
          size="sm"
          :disabled="!engine.duration.value"
          @click="engine.skip(SKIP_SECONDS)"
        />
        <IconButton icon="close" :label="t('music.closePlayer')" size="sm" @click="engine.close" />
      </div>
    </div>
  </div>
</template>
