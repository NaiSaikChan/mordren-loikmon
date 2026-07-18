<script setup lang="ts">
import type { Article } from '@loikmon/api'
import { computed, ref } from 'vue'

const props = defineProps<{ article: Article }>()

// Format views for readability (e.g., 1000 -> 1K, 1500000 -> 1.5M)
const formattedViews = computed(() => {
  const views = Number(props.article.views ?? 0)
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
  return String(views)
})

// Format rating with star icon
const formattedRating = computed(() => {
  const rating = Number(props.article.rating ?? 0)
  return rating > 0 ? rating.toFixed(1) : null
})

const articlePrice = computed(() => {
  const price = Number(props.article.price ?? props.article.amount ?? 0)
  const isFree = !!props.article.is_free || price === 0
  return { isFree, amount: isFree ? null : price }
})

// Format articledate as "dd MMM yyyy"
const formattedDate = computed(() => {
  const raw = props.article.articledate as string | undefined
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
})

// Social share
const copied = ref(false)
async function shareArticle(e: MouseEvent) {
  e.preventDefault()
  const url = `${window.location.origin}/articles/${props.article.id}`
  if (navigator.share) {
    try { await navigator.share({ title: String(props.article.title ?? ''), url }) } catch { /* cancelled */ }
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
        <img v-if="article.thumbnail_url || article.thumbnail"
          :src="(article.thumbnail_url ?? article.thumbnail) as string" :alt="article.title"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
        <span v-else class="text-2xl">📰</span>
      </div>

      <!-- Right Column: Content -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Title -->
        <h3
          class="py-0.5 text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {{ article.title }}
        </h3>

        <!-- Category + Price -->
        <div class="mt-1 flex flex-wrap gap-1">
          <div v-if="article.categoryname || article.category" class="shrink">
            <span class="inline-block px-2.5 py-0.5 bg-brand-600 text-white text-xs font-semibold rounded-full">
              {{ (article.categoryname ?? article.category) as string }}
            </span>
          </div>
          <div class="shrink">
            <span v-if="articlePrice.isFree"
              class="inline-block px-2.5 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">Free</span>
            <span v-else-if="articlePrice.amount"
              class="inline-block px-2.5 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full">
              🪙 {{ articlePrice.amount }} coins
            </span>
          </div>
        </div>
        
        <!-- Author + Date -->
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <span v-if="article.authorname || article.author" class="truncate">✍️ {{ (article.authorname ?? article.author) as string }}</span>
          <span v-if="formattedDate">📅 {{ formattedDate }}</span>
        </div>

        <!-- Views + Rating -->
        <div class="mt-1 flex items-center gap-3 text-xs">
          <span class="text-gray-700 dark:text-gray-300">👁️ {{ formattedViews }}</span>
          <span v-if="formattedRating" class="text-yellow-500 font-semibold">⭐ {{ formattedRating }}</span>
        </div>

        <!-- Actions -->
        <div class="mt-2 pt-2 border-t border-gray-100 dark:border-surface-700 flex items-center justify-end gap-1">
          <button
            class="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors text-base leading-none"
            :title="copied ? 'Link copied!' : 'Share'" @click="shareArticle">
            {{ copied ? '✅' : '🔗' }}
          </button>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
