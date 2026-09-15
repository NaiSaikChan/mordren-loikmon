<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaStore } from '@/stores/media'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import AccessBadge from '@/components/shared/AccessBadge.vue'

/** Audiobooks: books with audio chapters (`media.fetchAudioBooks`). Chapters are opened from the book page. */
const { t } = useI18n()
const store = useMediaStore()

function formatDuration(seconds: number) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

onMounted(() => {
  void store.fetchAudioBooks().catch(() => undefined)
})
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">🎧 {{ t('music.title') }}</h1>

    <LoadingSpinner v-if="store.loading && !store.books.length" />
    <EmptyState v-else-if="!store.loading && !store.books.length" icon="🎧" :title="t('music.noMusic')" />

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <RouterLink v-for="book in store.books" :key="book.id"
        :to="`/books/${book.id}`"
        class="group block card overflow-hidden">
        <div class="aspect-square bg-gray-100 dark:bg-surface-800 overflow-hidden relative">
          <img v-if="book.thumbnail"
            :src="book.thumbnail"
            :alt="book.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            @error="($event.target as HTMLImageElement).style.display='none'" />
          <div v-else class="w-full h-full flex items-center justify-center text-4xl">🎧</div>
          <div class="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-white text-xs flex items-center gap-1">
            🎧 {{ book.audio_chapters_count || t('music.audioBadge') }}
          </div>
        </div>
        <div class="p-2.5 space-y-1">
          <h3 class="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight">{{ book.title }}</h3>
          <p v-if="book.authorname" class="text-xs text-gray-400 truncate">{{ book.authorname }}</p>
          <div class="flex items-center justify-between gap-1">
            <AccessBadge :item="book" />
            <span v-if="book.audio_duration_seconds" class="text-xs text-gray-400">{{ formatDuration(book.audio_duration_seconds) }}</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Load more -->
    <div v-if="store.pagination?.has_more" class="mt-8 text-center">
      <button type="button" class="btn-secondary" :disabled="store.loading" @click="store.fetchAudioBooks(true)">
        {{ store.loading ? t('common.loading') : t('common.more') }}
      </button>
    </div>
  </div>
</template>
