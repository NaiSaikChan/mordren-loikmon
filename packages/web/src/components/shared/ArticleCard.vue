<script setup lang="ts">
import type { Article } from '@loikmon/api'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useArticleAudio } from '@/composables/useArticleAudio'
import AccessBadge from './AccessBadge.vue'

const props = defineProps<{ article: Article }>()
const { t } = useI18n()
// Fetches the article on click: plays the signed audio_url, or opens the paywall when locked.
const { hasAudio, loading: audioLoading, play } = useArticleAudio(() => props.article)

function listen(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  void play()
}

// Format views for readability (e.g., 1000 -> 1K, 1500000 -> 1.5M)
const formattedViews = computed(() => {
  const views = Number(props.article.views ?? 0)
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
  return String(views)
})

const formattedRating = computed(() => {
  const rating = Number(props.article.rating ?? 0)
  return rating > 0 ? rating.toFixed(1) : null
})

// Format the publication date as "dd MMM yyyy"
const formattedDate = computed(() => {
  const raw = props.article.articledate ?? props.article.published_at
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
})

const thumbnail = computed(() => props.article.thumbnail_url ?? props.article.thumbnail ?? '')

// Social share
const copied = ref(false)
async function shareArticle(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  const url = `${window.location.origin}/articles/${props.article.id}`
  if (navigator.share) {
    try { await navigator.share({ title: props.article.title ?? '', url }) } catch { /* cancelled */ }
  } else {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>

<template>
  <RouterLink :to="`/articles/${article.id}`" class="group block h-full">
    <div
      class="group overflow-hidden h-full flex gap-4 bg-white dark:bg-surface-900 hover:shadow-lg transition-all duration-300 rounded-xl border border-gray-200 dark:border-surface-700 p-4">

      <!-- Left Column: Thumbnail -->
      <div
        class="w-28 h-28 sm:w-36 sm:h-28 md:w-56 md:h-auto object-cover shadow-sm rounded-lg overflow-hidden bg-gray-100 dark:bg-surface-700 shrink-0 flex items-center justify-center bg-linear-to-br">
        <img v-if="thumbnail"
          :src="thumbnail" :alt="article.title"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
          decoding="async" />
        <span v-else class="text-2xl">📰</span>
      </div>

      <!-- Right Column: Content -->
      <div class="flex-1 flex flex-col min-w-0">
        <h3
          class="py-0.5 text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {{ article.title }}
        </h3>

        <!-- Category + access -->
        <div class="mt-1 flex flex-wrap gap-1">
          <span v-if="article.categoryname" class="inline-block px-2.5 py-0.5 bg-brand-600 text-white text-xs font-semibold rounded-full">
            {{ article.categoryname }}
          </span>
          <AccessBadge :item="article" />
        </div>

        <!-- Author + Date -->
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <span v-if="article.authorname" class="truncate">✍️ {{ article.authorname }}</span>
          <span v-if="formattedDate">📅 {{ formattedDate }}</span>
        </div>

        <!-- Views + Rating -->
        <div class="mt-1 flex items-center gap-3 text-xs">
          <span class="text-gray-700 dark:text-gray-300">👁️ {{ formattedViews }}</span>
          <span v-if="formattedRating" class="text-yellow-500 font-semibold">⭐ {{ formattedRating }}</span>
        </div>

        <!-- Actions -->
        <div class="mt-2 pt-2 border-t border-gray-100 dark:border-surface-700 flex items-center justify-end gap-1">
          <button v-if="hasAudio"
            type="button"
            class="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors text-base leading-none"
            :title="t('music.listen')"
            :aria-label="t('music.listen')"
            :disabled="audioLoading"
            data-testid="article-listen"
            @click="listen">
            {{ audioLoading ? '⏳' : '🎧' }}
          </button>
          <button
            type="button"
            class="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors text-base leading-none"
            :title="copied ? 'Link copied!' : 'Share'" @click="shareArticle">
            {{ copied ? '✅' : '🔗' }}
          </button>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
