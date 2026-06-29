<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useMediaStore } from '@/stores/media'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const { t } = useI18n()
const route = useRoute()
const store = useMediaStore()

const selectedLeague = ref<string>((route.query.league as string) ?? '')

function fixUrl(url?: string) {
  if (!url) return ''
  return url.replace(/\\/g, '/').replace(/ /g, '%20')
}

const filteredBooks = computed(() => {
  if (!selectedLeague.value) return store.books
  return store.books.filter((b: any) => String(b.league ?? b.category ?? b.cat) === selectedLeague.value)
})

onMounted(async () => {
  await store.fetchLeagues()
  await store.fetchMediaBooks()
})
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('music.title') }}</h1>

    <!-- League / category tabs -->
    <div v-if="store.leagues.length" class="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
      <button :class="['shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
          !selectedLeague ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-gray-300 hover:bg-gray-200']"
        @click="selectedLeague = ''">All</button>
      <button v-for="l in store.leagues" :key="l.id"
        :class="['shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
          selectedLeague === String(l.id) ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-gray-300 hover:bg-gray-200']"
        @click="selectedLeague = String(l.id)">
        {{ l.name ?? l.title }}
      </button>
    </div>

    <LoadingSpinner v-if="store.loading && !store.books.length" />
    <EmptyState v-else-if="!store.loading && !filteredBooks.length" icon="🎵" :title="t('common.notFound')" />

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <RouterLink v-for="book in filteredBooks" :key="book.id"
        :to="`/books/${book.id}`"
        class="group block card overflow-hidden">
        <div class="aspect-square bg-gray-100 dark:bg-surface-800 overflow-hidden relative">
          <img v-if="fixUrl(book.thumbnail ?? book.coverphoto)"
            :src="fixUrl(book.thumbnail ?? book.coverphoto)"
            :alt="book.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            @error="($event.target as HTMLImageElement).style.display='none'" />
          <div v-else class="w-full h-full flex items-center justify-center text-4xl">🎵</div>
          <div class="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-white text-xs flex items-center gap-1">
            🎧 Audio
          </div>
        </div>
        <div class="p-2.5">
          <h3 class="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight">{{ book.title }}</h3>
          <p v-if="book.authorname ?? book.author" class="text-xs text-gray-400 truncate mt-0.5">
            {{ book.authorname ?? book.author }}
          </p>
        </div>
      </RouterLink>
    </div>

    <!-- Load more -->
    <div v-if="store.books.length && !store.loading" class="mt-8 text-center">
      <button class="btn-secondary" @click="store.fetchMediaBooks(undefined, true)">
        {{ t('common.more') }}
      </button>
    </div>
  </div>
</template>
